'use strict'
const dico = require('./dictionnaires')
const { genererUne } = require('./questions')

const CECR   = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const QUALITE = ['aleatoire', 'meme-theme', 'meme-classe']

function ri(min, max) { return min + Math.floor(Math.random() * (max - min + 1)) }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }
function cecrs(lo, hi) { return [...new Set([CECR[lo], CECR[hi]])] }

// Génère une config de difficulté calibrée pour un niveau donné (1–40).
// Chaque dimension est échantillonnée indépendamment dans une fenêtre glissante
// centrée sur la courbe cible, ce qui produit des questions de même difficulté
// globale mais de styles variés.
function genererConfig(niveau) {
  const p = (niveau - 1) / 39   // 0 au niveau 1, 1 au niveau 40

  // Nombre de choix : 2 bas → 6 haut, ±1 de bruit
  const cChoix = 2 + p * 4
  const nb_choix = clamp(ri(Math.round(cChoix - 1), Math.round(cChoix + 1)), 2, 6)

  // Temps : 25s bas → 6s haut, ±4s de bruit
  const cTemps = Math.round(25 - p * 19)
  const tempsSecondes = clamp(ri(cTemps - 4, cTemps + 4), 6, 25)

  // Niveau CECR du mot : glisse de A1 vers C2
  const cCecr = p * 5
  const cecrMotLo = clamp(Math.round(cCecr - 1), 0, 5)
  const cecrMotHi = clamp(Math.round(cCecr + 0.3), 0, 5)
  const niveaux_mot = cecrs(cecrMotLo, cecrMotHi)

  // Niveau CECR des distracteurs : légèrement décalé, nul en début de partie
  const cCecrD = p * 5 - 0.5
  let niveaux_distract
  if (cCecrD < 0) {
    niveaux_distract = null
  } else {
    const cecrDistLo = clamp(Math.round(cCecrD - 1), 0, 5)
    const cecrDistHi = clamp(Math.round(cCecrD + 0.3), 0, 5)
    niveaux_distract = cecrs(cecrDistLo, cecrDistHi)
  }

  // Qualité distracteurs : aléatoire → même-thème → même-classe
  const cQual = p * 2
  const qualite = QUALITE[clamp(ri(Math.round(cQual - 0.8), Math.round(cQual + 0.8)), 0, 2)]

  // Type de question : contexte progressivement requis
  const type = p < 0.30 || (p < 0.45 && Math.random() > 0.5)
    ? 'traduction-base'
    : 'traduction-contexte'

  // Seuil cognate : 1.0 bas → 0.30 haut, ±0.12 de bruit
  const cCognate = 1.0 - p * 0.7
  const seuil_cognate = clamp(+(cCognate - 0.12 + Math.random() * 0.24).toFixed(2), 0.30, 1.00)

  return { type, nb_choix, qualite, niveaux_mot, niveaux_distract, tempsSecondes, seuil_cognate }
}

const _cache = {}

function chargerSource(source) {
  if (_cache[source]) return _cache[source]
  const entrees = source === 'tous' ? dico.chargerTous() : dico.charger(source)
  const toutes  = dico.chargerTous()
  _cache[source] = { entrees, toutes }
  return _cache[source]
}

function genererPourJoueur(joueur, source) {
  const { entrees, toutes } = chargerSource(source)
  const niveau = Math.min(40, Math.max(1, Math.round(joueur.niveau)))
  const preset = genererConfig(niveau)

  const question = genererUne({
    entrees,
    toutes,
    type:             preset.type,
    nb_choix:         preset.nb_choix,
    qualite:          preset.qualite,
    niveaux_mot:      preset.niveaux_mot,
    niveaux_distract: preset.niveaux_distract,
    seuil_cognate:    preset.seuil_cognate,
    source,
    exclure:          joueur.questionsVues,
  })

  if (question) {
    joueur.questionsVues.add(question.mot)
    question.index         = joueur.reponses.length
    question.tempsDebut    = Date.now()
    question.tempsSecondes = preset.tempsSecondes
    question.difficulte    = niveau
  }

  return question
}

module.exports = { genererPourJoueur, chargerSource }
