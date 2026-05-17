'use strict'
const fs   = require('fs')
const path = require('path')

const DICO_DIR = path.join(__dirname, 'data')

const CHAMPS = {
  mot:         ['mot', 'word', 'terme'],
  article:     ['article'],
  genre:       ['genre', 'gender'],
  nature:      ['nature', 'classe', 'pos'],
  niveau_cecr: ['niveau', 'niveau_cecr', 'niveau cecr', 'cefr'],
  définition:  ['définition fr', 'définition', 'definition fr', 'definition'],
  traduction:  ['équivalent en', 'equivalent en', 'traduction', 'translation', 'english'],
  thème:       ['thème', 'theme', 'topic'],
  note:        ["note d'usage", 'note', 'usage'],
  exemple:     ['exemple en contexte', 'exemple', 'example', 'contexte'],
  alt_en:      ['alt en', 'alt_en', 'alternatives en'],
}

function normaliserNature(raw) {
  const r = (raw || '').toLowerCase()
  if (r.match(/^n\.|nom|noun/))          return 'nom'
  if (r.match(/^v\.|verb/))              return 'verbe'
  if (r.match(/^adj\.|adjectif|adjec/))  return 'adjectif'
  if (r.match(/^adv\.|adverbe|adverb/))  return 'adverbe'
  if (r.match(/^prép\.|prépos/))         return 'préposition'
  if (r.match(/^conj\./))               return 'conjonction'
  return raw || ''
}

function parserLigne(ligne) {
  const cols = []
  let dansCotes = false
  let courant = ''
  for (const c of ligne) {
    if (c === '"') { dansCotes = !dansCotes; continue }
    if (c === ',' && !dansCotes) { cols.push(courant.trim()); courant = ''; continue }
    courant += c
  }
  cols.push(courant.trim())
  return cols
}

function parserCSV(contenu) {
  const lignes = contenu.replace(/\r/g, '').split('\n').filter(Boolean)
  if (lignes.length < 2) return []

  const entete = parserLigne(lignes[0].replace(/^﻿/, ''))
    .map(h => h.replace(/"/g, '').trim().toLowerCase())

  const idx = {}
  for (const [champ, aliases] of Object.entries(CHAMPS)) {
    for (const alias of aliases) {
      const i = entete.findIndex(h => h === alias || h.includes(alias))
      if (i !== -1) { idx[champ] = i; break }
    }
  }

  const get = (cols, champ) => (cols[idx[champ]] || '').trim()

  return lignes.slice(1).map(l => {
    const cols = parserLigne(l)
    const motBrut = get(cols, 'mot')
    if (!motBrut) return null

    const matchArticle = motBrut.match(/^(un|une|le|la|les|l[''])\s+(.+)$/i)
    const mot     = matchArticle ? matchArticle[2].trim() : motBrut
    const article = get(cols, 'article') || (matchArticle ? matchArticle[1].toLowerCase() : '')

    const altRaw = get(cols, 'alt_en')
    const alt_en = altRaw ? altRaw.split('|').map(s => s.trim()).filter(Boolean) : []

    return {
      mot,
      article,
      genre:       get(cols, 'genre'),
      nature:      normaliserNature(get(cols, 'nature')),
      niveau_cecr: get(cols, 'niveau_cecr'),
      définition:  get(cols, 'définition'),
      traduction:  get(cols, 'traduction'),
      alt_en,
      thème:       get(cols, 'thème'),
      note:        get(cols, 'note'),
      exemple:     get(cols, 'exemple'),
    }
  }).filter(Boolean)
}

function lister() {
  if (!fs.existsSync(DICO_DIR)) return []
  return fs.readdirSync(DICO_DIR)
    .filter(f => f.endsWith('.csv'))
    .map(f => {
      const nom    = f.replace('.csv', '')
      const chemin = path.join(DICO_DIR, f)
      const entrees = parserCSV(fs.readFileSync(chemin, 'utf8'))
      return { nom, fichier: f, entrees: entrees.length }
    })
}

function charger(nom) {
  const chemin = path.join(DICO_DIR, `${nom}.csv`)
  if (!fs.existsSync(chemin)) return []
  return parserCSV(fs.readFileSync(chemin, 'utf8'))
}

function chargerTous() {
  if (!fs.existsSync(DICO_DIR)) return []
  return fs.readdirSync(DICO_DIR)
    .filter(f => f.endsWith('.csv'))
    .flatMap(f => parserCSV(fs.readFileSync(path.join(DICO_DIR, f), 'utf8')))
}

module.exports = { lister, charger, chargerTous }