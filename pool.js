'use strict'
const fs   = require('fs');
const path = require('path');

const POOL_PATH = path.join(__dirname, 'pool.json');

function piocherAcceptees(n) {
  if (!fs.existsSync(POOL_PATH)) return [];
  const acceptees = JSON.parse(fs.readFileSync(POOL_PATH, 'utf8')).filter(q => q.statut === 'accepted');
  for (let i = acceptees.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [acceptees[i], acceptees[j]] = [acceptees[j], acceptees[i]];
  }
  return acceptees.slice(0, n);
}

module.exports = { piocherAcceptees };
