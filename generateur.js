'use strict'
const dico = require('./dictionnaires')
const { genererUne } = require('./questions')

// niveau 1-10 → 5 dimensions : type · nb_choix · qualité distracteurs · CECR mot · CECR distracteurs · temps (s)
const PRESETS = [
  null,
  { type: 'traduction-base',     nb_choix: 2, qualite: 'aleatoire',   niveaux_mot: ['A1'],        niveaux_distract: null,         tempsSecondes: 20 }, // 1
  { type: 'traduction-base',     nb_choix: 2, qualite: 'aleatoire',   niveaux_mot: ['A1','A2'],   niveaux_distract: ['A1'],       tempsSecondes: 18 }, // 2
  { type: 'traduction-base',     nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['A2'],        niveaux_distract: ['A1','A2'],  tempsSecondes: 16 }, // 3
  { type: 'traduction-base',     nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['A2','B1'],   niveaux_distract: ['A1','A2'],  tempsSecondes: 14 }, // 4
  { type: 'traduction-contexte', nb_choix: 2, qualite: 'aleatoire',   niveaux_mot: ['B1'],        niveaux_distract: ['A2','B1'],  tempsSecondes: 12 }, // 5
  { type: 'traduction-contexte', nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['B1','B2'],   niveaux_distract: ['B1'],       tempsSecondes: 10 }, // 6
  { type: 'traduction-contexte', nb_choix: 3, qualite: 'meme-theme',  niveaux_mot: ['B2'],        niveaux_distract: ['B1','B2'],  tempsSecondes:  9 }, // 7
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'meme-theme',  niveaux_mot: ['B2','C1'],   niveaux_distract: ['B1','B2'],  tempsSecondes:  8 }, // 8
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'meme-classe', niveaux_mot: ['C1'],        niveaux_distract: ['B2','C1'],  tempsSecondes:  7 }, // 9
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'meme-classe', niveaux_mot: ['C1','C2'],   niveaux_distract: ['C1','C2'],  tempsSecondes:  5 }, // 10
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
  const niveau = Math.min(10, Math.max(1, Math.round(joueur.niveau)))
  const preset = PRESETS[niveau]

  const question = genererUne({
    entrees,
    toutes,
    type:             preset.type,
    nb_choix:         preset.nb_choix,
    qualite:          preset.qualite,
    niveaux_mot:      preset.niveaux_mot,
    niveaux_distract: preset.niveaux_distract,
    source,
    exclure:          joueur.questionsVues,
  })

  if (question) {
    joueur.questionsVues.add(question.mot)
    question.index        = joueur.reponses.length
    question.tempsDebut   = Date.now()
    question.tempsSecondes = preset.tempsSecondes
    question.difficulte   = niveau
  }

  return question
}

module.exports = { genererPourJoueur, chargerSource }
