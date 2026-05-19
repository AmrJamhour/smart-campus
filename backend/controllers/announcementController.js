const { query } = require('../config/db');

const TARGET_ROLES = ['all', 'students', 'professors'];

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function normalizeTargetRole(value) {
  const role = String(value || 'all').trim().toLowerCase();
  return TARGET_ROLES.includes(role) ? role : 'all';
}

function normalizeTargetDepartment(value) {
  const department = String(value || 'all').trim();
  return department || 'all';
}

function isAdminUser(user) {
  return ['admin', 'super_admin'].includes(String(user?.role || '').toLowerCase());
}

function getAnnouncementRoleForUser(user) {
  const role = String(user?.role || '').toLowerCase();

  if (role === 'student') return 'students';

  if (['professor', 'instructor', 'faculty', 'doctor'].includes(role)) {
    return 'professors';
  }

  return 'all';
}

function getUserDepartment(user) {
  return String(user?.department || '').trim();
}

async function getAnnouncements(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      pinned_only = 'false',
      target_role,
      target_department,
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const params = [];
    let idx = 1;

    let sql = `
      SELECT a.*, u.first_name || ' ' || u.last_name AS author_name
      FROM announcements a
      LEFT JOIN users u ON u.id = a.author_id
      WHERE 1=1
    `;

    if (!isAdminUser(req.user)) {
      const announcementRole = getAnnouncementRoleForUser(req.user);
      const userDepartment = getUserDepartment(req.user);

      sql += `
        AND a.is_published = TRUE
        AND (a.published_at IS NULL OR a.published_at <= NOW())
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND COALESCE(a.target_role, 'all') IN ('all', $${idx++})
      `;
      params.push(announcementRole);

      if (userDepartment) {
        sql += ` AND (COALESCE(a.target_department, 'all') = 'all' OR LOWER(a.target_department) = LOWER($${idx++}))`;
        params.push(userDepartment);
      } else {
        sql += ` AND COALESCE(a.target_department, 'all') = 'all'`;
      }
    } else {
      if (target_role) {
        params.push(normalizeTargetRole(target_role));
        sql += ` AND COALESCE(a.target_role, 'all') = $${idx++}`;
      }

      if (target_department) {
        params.push(normalizeTargetDepartment(target_department));
        sql += ` AND COALESCE(a.target_department, 'all') = $${idx++}`;
      }
    }

    if (pinned_only === 'true') {
      sql += ' AND a.is_pinned = TRUE';
    }

    const countResult = await query(`SELECT COUNT(*) FROM (${sql}) t`, params);
    const total = parseInt(countResult.rows[0].count, 10) || 0;

    sql += ` ORDER BY a.is_pinned DESC, a.published_at DESC NULLS LAST, a.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limitNum, offset);

    const result = await query(sql, params);

    res.json({
      success: true,
      data: {
        announcements: result.rows,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}


async function getTargetDepartments(req, res, next) {
  try {
    const departments = new Set();

    async function columnExists(tableName, columnName) {
      const result = await query(
        `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
        LIMIT 1
        `,
        [tableName, columnName]
      );

      return result.rows.length > 0;
    }

    async function addDepartmentsFrom(tableName, columnName = 'department') {
      const exists = await columnExists(tableName, columnName);

      if (!exists) return;

      const result = await query(
        `
        SELECT DISTINCT TRIM(${columnName}) AS department
        FROM ${tableName}
        WHERE ${columnName} IS NOT NULL
          AND TRIM(${columnName}) <> ''
        ORDER BY TRIM(${columnName})
        `
      );

      result.rows.forEach(row => {
        if (row.department) departments.add(row.department);
      });
    }

    await addDepartmentsFrom('users', 'department');
    await addDepartmentsFrom('instructors', 'department');
    await addDepartmentsFrom('courses', 'department');
    await addDepartmentsFrom('rooms', 'department');

    res.json({
      success: true,
      data: {
        departments: Array.from(departments).sort((a, b) =>
          a.localeCompare(b, 'en')
        ),
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getAnnouncementById(req, res, next) {
  try {
    const params = [req.params.id];
    let idx = 2;

    let sql = `
      SELECT a.*, u.first_name || ' ' || u.last_name AS author_name
      FROM announcements a
      LEFT JOIN users u ON u.id = a.author_id
      WHERE a.id = $1
    `;

    if (!isAdminUser(req.user)) {
      const announcementRole = getAnnouncementRoleForUser(req.user);
      const userDepartment = getUserDepartment(req.user);

      sql += `
        AND a.is_published = TRUE
        AND (a.published_at IS NULL OR a.published_at <= NOW())
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND COALESCE(a.target_role, 'all') IN ('all', $${idx++})
      `;
      params.push(announcementRole);

      if (userDepartment) {
        sql += ` AND (COALESCE(a.target_department, 'all') = 'all' OR LOWER(a.target_department) = LOWER($${idx++}))`;
        params.push(userDepartment);
      } else {
        sql += ` AND COALESCE(a.target_department, 'all') = 'all'`;
      }
    }

    const result = await query(sql, params);

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    res.json({ success: true, data: { announcement: result.rows[0] } });
  } catch (error) {
    next(error);
  }
}

async function createAnnouncement(req, res, next) {
  try {
    const {
      title,
      content,
      expires_at,
      publish_at,
    } = req.body;

    const is_pinned = toBool(req.body.is_pinned, false);
    const is_published = toBool(req.body.is_published, false);
    const target_role = normalizeTargetRole(req.body.target_role);
    const target_department = normalizeTargetDepartment(req.body.target_department);
    const image_url = req.file ? `/uploads/announcements/${req.file.filename}` : null;

    const result = await query(
      `INSERT INTO announcements
         (title, content, image_url, author_id, is_pinned, is_published,
          published_at, expires_at, target_role, target_department)
       VALUES (
         $1,$2,$3,$4,$5,$6,
         CASE
           WHEN $6 THEN COALESCE($7::timestamptz, NOW())
           ELSE NULL
         END,
         $8,$9,$10
       )
       RETURNING *`,
      [
        title,
        content,
        image_url,
        req.user.id,
        is_pinned,
        is_published,
        publish_at || null,
        expires_at || null,
        target_role,
        target_department,
      ]
    );

    res.status(201).json({
      success: true,
      data: { announcement: result.rows[0] },
    });
  } catch (error) {
    next(error);
  }
}

async function updateAnnouncement(req, res, next) {
  try {
    const { id } = req.params;
    const fields = [];
    const values = [];
    let idx = 1;

    const publishAt =
      req.body.publish_at !== undefined
        ? req.body.publish_at || null
        : req.body.published_at !== undefined
          ? req.body.published_at || null
          : undefined;

    if (req.body.title !== undefined) {
      fields.push(`title=$${idx++}`);
      values.push(req.body.title);
    }

    if (req.body.content !== undefined) {
      fields.push(`content=$${idx++}`);
      values.push(req.body.content);
    }

    if (req.body.is_pinned !== undefined) {
      fields.push(`is_pinned=$${idx++}`);
      values.push(toBool(req.body.is_pinned, false));
    }

    if (req.body.expires_at !== undefined) {
      fields.push(`expires_at=$${idx++}`);
      values.push(req.body.expires_at || null);
    }

    if (req.body.target_role !== undefined) {
      fields.push(`target_role=$${idx++}`);
      values.push(normalizeTargetRole(req.body.target_role));
    }

    if (req.body.target_department !== undefined) {
      fields.push(`target_department=$${idx++}`);
      values.push(normalizeTargetDepartment(req.body.target_department));
    }

    if (req.body.is_published !== undefined) {
      const isPublished = toBool(req.body.is_published, false);

      fields.push(`is_published=$${idx++}`);
      values.push(isPublished);

      fields.push(`
        published_at = CASE
          WHEN $${idx++} = FALSE THEN NULL
          WHEN $${idx++}::timestamptz IS NOT NULL THEN $${idx - 1}::timestamptz
          WHEN published_at IS NULL THEN NOW()
          ELSE published_at
        END
      `);
      values.push(isPublished);
      values.push(publishAt);
    } else if (publishAt !== undefined) {
      fields.push(`published_at=$${idx++}`);
      values.push(publishAt);
    }

    if (req.file) {
      fields.push(`image_url=$${idx++}`);
      values.push(`/uploads/announcements/${req.file.filename}`);
    }

    if (!fields.length) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update.',
      });
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const result = await query(
      `UPDATE announcements SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    res.json({ success: true, data: { announcement: result.rows[0] } });
  } catch (error) {
    next(error);
  }
}

async function deleteAnnouncement(req, res, next) {
  try {
    const result = await query(
      'DELETE FROM announcements WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    res.json({ success: true, message: 'Deleted.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getTargetDepartments,
};
