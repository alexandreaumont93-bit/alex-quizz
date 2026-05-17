'use strict'

const SCORE_TYPE = {
  'traduction-base':     1,
  'traduction-contexte': 2,
  'genre':               1,
}
const SCORE_CHOIX        = { 2: 0, 3: 1, 4: 2 }
const SCORE_DISTRACTEURS = { 'aleatoire': 0, 'meme-theme': 1, 'meme-classe': 2 }

function calculerDifficulte(type, nb_choix, qualite) {
  return (SCORE_TYPE[type] || 1) + (SCORE_CHOIX[nb_choix] || 0) + (SCORE_DISTRACTEURS[qualite] || 0)
}

function melanger(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function choisirDistracteurs(entree, toutes, nb, qualite) {
  let pool = toutes.filter(e => e.traduction && e.traduction !== entree.traduction && e.mot !== entree.mot)
  if (qualite === 'meme-classe') {
    const f = pool.filter(e => e.nature === entree.nature)
    if (f.length >= nb) pool = f
  } else if (qualite === 'meme-theme') {
    const f = pool.filter(e => e.thème === entree.thème)
    if (f.length >= nb) pool = f
  }
  return melanger(pool).slice(0, nb).map(e => e.traduction)
}

function fabriquer(entree, toutes, type, nb_choix, qualite) {
  if (type === 'traduction-base') {
    if (!entree.traduction) return null
    const dist = choisirDistracteurs(entree, toutes, nb_choix - 1, qualite)
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
    const dist = choisirDistracteurs(entree, toutes, nb_choix - 1, qualite)
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
    const art = entree.article.toLowerCase()
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

// Génère une seule question pour un joueur, en évitant les mots déjà vus
function genererUne({ entrees, toutes, type, nb_choix, qualite, source, exclure = new Set() }) {
  const disponibles = exclure.size > 0 ? entrees.filter(e => !exclure.has(e.mot)) : entrees
  const pool = disponibles.length >= 2 ? disponibles : entrees

  for (const entree of melanger(pool)) {
    const nbEff = type.startsWith('genre') ? parseInt(type.slice(-1)) : nb_choix
    const resultat = fabriquer(entree, toutes, type, nbEff, qualite)
    if (!resultat) continue

    const typeBase = type.startsWith('genre') ? 'genre' : type
    return {
      mot:       resultat.mot,
      source:    source || '',
      type,
      difficulte: calculerDifficulte(typeBase, resultat.options.length, qualite),
      options:   resultat.options,
      contexte:  resultat.contexte,
      info: {
        article:    entree.article     || '',
        genre:      entree.genre       || '',
        nature:     entree.nature      || '',
        niveau_cecr: entree.niveau_cecr || '',
        thème:      entree.thème       || '',
        syntaxe:    entree.exemple     || '',
        classe:     entree.nature      || '',
      },
    }
  }
  return null
}

module.exports = { genererUne, calculerDifficulte, SCORE_TYPE, SCORE_CHOIX, SCORE_DISTRACTEURS }