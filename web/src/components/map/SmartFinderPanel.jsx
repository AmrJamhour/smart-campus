import React from 'react';
import { motion } from 'framer-motion';
import './SmartFinderPanel.css';

const QUICK_REQUEST_VALUES = [
  'all',
  'lecture_hall',
  'lab',
  'office',
  'restroom',
  'stairs',
  'elevator',
  'accessible',
];

const REQUEST_ICON_MAP = {
  all: '✨',
  lab: '🧪',
  lecture_hall: '🎓',
  engineering_drawing_studio: '✏️',
  bookstore: '📚',
  office: '👨‍🏫',
  meeting_room: '🤝',
  professor_lounge: '☕',
  storage: '📦',
  stairs: '🪜',
  restroom: '🚻',
  amphitheater: '🏛️',
  entrance: '🚪',
  bathroom: '♿',
  elevator: '🛗',
  emergency_stairs: '🚨',
  accessible: '♿',
};

function getRequestIcon(value) {
  return REQUEST_ICON_MAP[value] || '📍';
}

export default function SmartFinderPanel({
  requestOptions = [],
  selectedNeed = 'all',
  setSelectedNeed,
  setSelectedBlock,
  visibleBlocks = [],
}) {
  const safeRequestOptions = Array.isArray(requestOptions) ? requestOptions : [];
  const safeVisibleBlocks = Array.isArray(visibleBlocks) ? visibleBlocks : [];

  const activeOption =
    safeRequestOptions.find(option => option.value === selectedNeed) ||
    safeRequestOptions[0];

  function handleNeedChange(value) {
    if (typeof setSelectedNeed === 'function') {
      setSelectedNeed(value);
    }

    if (typeof setSelectedBlock === 'function') {
      setSelectedBlock(null);
    }
  }

  return (
    <motion.div
      className="map-tools-card map-tools-card--pro"
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      <div className="map-tools-glow" aria-hidden="true" />

      <div className="map-tools-head-pro">
        <motion.div
          className="map-tools-icon-pro"
          animate={{ rotate: [0, -4, 4, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          🧭
        </motion.div>

        <div>
          <span className="map-tools-eyebrow">Smart Finder</span>
          <h3>What do you need?</h3>
          <p>Choose a category, then click any highlighted room on the map.</p>
        </div>
      </div>

      <div className="map-filter-pills" role="tablist" aria-label="Map filters">
        {safeRequestOptions
          .filter(option => QUICK_REQUEST_VALUES.includes(option.value))
          .map(option => {
            const active = selectedNeed === option.value;

            return (
              <motion.button
                key={option.value}
                type="button"
                className={`map-filter-pill ${active ? 'active' : ''}`}
                onClick={() => handleNeedChange(option.value)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
              >
                <span>{getRequestIcon(option.value)}</span>
                {option.label}
              </motion.button>
            );
          })}
      </div>

      <div className="map-select-group-pro">
        <label>More categories</label>

        <div className="map-select-shell-pro">
          <select
            className="map-need-select map-need-select--pro"
            value={selectedNeed}
            onChange={event => handleNeedChange(event.target.value)}
          >
            {safeRequestOptions.map(option => (
              <option key={option.value} value={option.value}>
                {getRequestIcon(option.value)} {option.label}
              </option>
            ))}
          </select>

          <span className="map-select-arrow">⌄</span>
        </div>
      </div>

      <div className="map-tools-summary-pro">
        <motion.div
          className="map-summary-box"
          key={`summary-${selectedNeed}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <span>Showing</span>

          <strong>
            {selectedNeed === 'all'
              ? 'All interactive blocks'
              : activeOption?.label || 'Selected category'}
          </strong>
        </motion.div>

        <motion.div
          className="map-summary-box map-summary-box--count"
          key={`count-${safeVisibleBlocks.length}`}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <span>Found</span>
          <strong>{safeVisibleBlocks.length}</strong>
        </motion.div>
      </div>
    </motion.div>
  );
}