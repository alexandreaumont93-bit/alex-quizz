'use strict'

// Distance de Levenshtein (in-place row)
function levenshtein(a, b) {
  const m = a.length, n = b.length
  const row = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = row[0]++
    for (let j = 1; j <= n; j++) {
      const tmp = row[j]
      row[j] = a[i-1] === b[j-1] ? prev : 1 + Math.min(prev, row[j], row[j-1])
      prev = tmp
    }
  }
  return row[n]
}

// Similitude 0-1 entre le mot français et son équivalent anglais
// 1 = identiques, 0 = rien en commun
function similitudeCognate(motFr, motEn) {
  const norm = s => (s || '').toLowerCase()
    .replace(/^to\s+/, '')                        // strip "to " des verbes anglais
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // supprimer accents
    .replace(/[^a-z]/g, '')
  const fr = norm(motFr), en = norm(motEn)
  if (!fr || !en) return 0
  const maxLen = Math.max(fr.length, en.length)
  return maxLen === 0 ? 0 : 1 - levenshtein(fr, en) / maxLen
}

function melanger(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function choisirDistracteurs(entree, toutes, nb, qualite, niveaux_distract) {
  let pool = toutes.filter(e => e.traduction && e.traduction !== entree.traduction && e.mot !== entree.mot)

  // Filtrer les distracteurs par niveau CECR si précisé
  if (niveaux_distract && niveaux_distract.length > 0) {
    const f = pool.filter(e => niveaux_distract.includes(e.niveau_cecr))
    if (f.length >= nb) pool = f
  }

  if (qualite === 'meme-classe') {
    const f = pool.filter(e => e.nature === entree.nature)
    if (f.length >= nb) pool = f
  } else if (qualite === 'meme-theme') {
    const f = pool.filter(e => e.thème === entree.thème)
    if (f.length >= nb) pool = f
  }

  return melanger(pool).slice(0, nb).map(e => e.traduction)
}

function fabriquer(entree, toutes, type, nb_choix, qualite, niveaux_distract) {
  if (type === 'traduction-base') {
    if (!entree.traduction) return null
    const dist = choisirDistracteurs(entree, toutes, nb_choix - 1, qualite, niveaux_distract)
    if (dist.length < nb_choix - 1) return null
    return {
      mot: entree.mot,
      contexte: null,
      options: melanger([
        { texte: entree.traduction, correcte: true },
        ...dist.map(d => ({ texte: d, correcte: false })),
      ]),
    }
  }
  if (type === 'traduction-contexte') {
    if (!entree.traduction || !entree.exemple) return null
    const dist = choisirDistracteurs(entree, toutes, nb_choix - 1, qualite, niveaux_distract)
    if (dist.length < nb_choix - 1) return null
    return {
      mot: entree.mot,
      contexte: entree.exemple,
      options: melanger([
        { texte: entree.traduction, correcte: true },
        ...dist.map(d => ({ texte: d, correcte: false })),
      ]),
    }
  }
  if (type === 'genre-2') {
    if (!entree.article || !entree.mot) return null
    const art = entree.article.toLowerCase()
    const opp = art === 'un' ? 'une' : art === 'une' ? 'un' : null
    if (!opp) return null
    return {
      mot: entree.mot,
      contexte: null,
      options: melanger([
        { texte: `${art} ${entree.mot}`, correcte: true },
        { texte: `${opp} ${entree.mot}`, correcte: false },
      ]),
    }
  }
  if (type === 'genre-4') {
    if (!entree.article || !entree.mot) return null
    const autres = melanger(toutes.filter(e => e.article && e.mot !== entree.mot)).slice(0, 3)
    if (autres.length < 3) return null
    const art   = entree.article.toLowerCase()
    const genre = art === 'un' ? 'masculin' : 'féminin'
    return {
      mot: entree.mot,
      contexte: `Lequel est ${genre} ?`,
      options: melanger([
        { texte: `${art} ${entree.mot}`, correcte: true },
        ...autres.map(e => ({ texte: `${e.article.toLowerCase()} ${e.mot}`, correcte: false })),
      ]),
    }
  }
  return null
}

function genererUne({ entrees, toutes, type, nb_choix, qualite, source, exclure = new Set(), niveaux_mot, niveaux_distract, seuil_cognate }) {
  // Filtrer les candidats par niveau CECR si précisé
  let candidats = entrees
  if (niveaux_mot && niveaux_mot.length > 0) {
    const f = entrees.filter(e => niveaux_mot.includes(e.niveau_cecr))
    if (f.length >= 2) candidats = f
  }

  // Filtrer les cognates selon le seuil (graduel avec le niveau de difficulté)
  if (typeof seuil_cognate === 'number' && seuil_cognate < 1) {
    const f = candidats.filter(e => similitudeCognate(e.mot, e.traduction) <= seuil_cognate)
    if (f.length >= 2) candidats = f
  }

  const disponibles = exclure.size > 0 ? candidats.filter(e => !exclure.has(e.mot)) : candidats
  const pool = disponibles.length >= 2 ? disponibles : candidats

  for (const entree of melanger(pool)) {
    const nbEff    = type.startsWith('genre') ? parseInt(type.slice(-1)) : nb_choix
    const resultat = fabriquer(entree, toutes, type, nbEff, qualite, niveaux_distract)
    if (!resultat) continue

    return {
      mot:       resultat.mot,
      source:    source || '',
      type,
      options:   resultat.options,
      contexte:  resultat.contexte,
      info: {
        article:     entree.article      || '',
        genre:       entree.genre        || '',
        nature:      entree.nature       || '',
        niveau_cecr: entree.niveau_cecr  || '',
        thème:       entree.thème        || '',
        syntaxe:     entree.exemple      || '',
        classe:      entree.nature       || '',
      },
    }
  }
  return null
}

module.exports = { genererUne }
