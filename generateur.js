'use strict'
const dico = require('./dictionnaires')
const { genererUne } = require('./questions')

// niveau 1-7 → paramètres de génération
const PRESETS = [
  null,
  { type: 'traduction-base',     nb_choix: 2, qualite: 'aleatoire'   }, // 1 — très facile
  { type: 'traduction-base',     nb_choix: 3, qualite: 'aleatoire'   }, // 2
  { type: 'traduction-base',     nb_choix: 4, qualite: 'aleatoire'   }, // 3
  { type: 'traduction-contexte', nb_choix: 2, qualite: 'aleatoire'   }, // 4
  { type: 'traduction-contexte', nb_choix: 3, qualite: 'aleatoire'   }, // 5
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'aleatoire'   }, // 6
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'meme-classe' }, // 7 — difficile
]

const _cache = {}

function chargerSource(source) {
  if (_cache[source]) return _cache[source]
  const entrees = dico.charger(source)
  const toutes  = dico.chargerTous()
  _cache[source] = { entrees, toutes }
  return _cache[source]
}

function genererPourJoueur(joueur, source) {
  const { entrees, toutes } = chargerSource(source)
  const niveau = Math.min(7, Math.max(1, Math.round(joueur.niveau)))
  const preset = PRESETS[niveau]

  const question = genererUne({
    entrees,
    toutes,
    type:    preset.type,
    nb_choix: preset.nb_choix,
    qualite: preset.qualite,
    source,
    exclure: joueur.questionsVues,
  })

  if (question) {
    joueur.questionsVues.add(question.mot)
    question.index     = joueur.reponses.length
    question.tempsDebut = Date.now()
  }

  return question
}

module.exports = { genererPourJoueur, chargerSource }