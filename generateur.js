'use strict'
const dico = require('./dictionnaires')
const { genererUne } = require('./questions')

// niveau 1-40 → 5 dimensions : type · nb_choix · qualité distracteurs · CECR mot · CECR distracteurs · temps (s)
// Chaque niveau change 1-2 dimensions max pour une progression graduelle.
const PRESETS = [
  null,
  { type: 'traduction-base',     nb_choix: 2, qualite: 'aleatoire',   niveaux_mot: ['A1'],        niveaux_distract: null,         tempsSecondes: 25 }, //  1
  { type: 'traduction-base',     nb_choix: 2, qualite: 'aleatoire',   niveaux_mot: ['A1'],        niveaux_distract: null,         tempsSecondes: 24 }, //  2
  { type: 'traduction-base',     nb_choix: 2, qualite: 'aleatoire',   niveaux_mot: ['A1'],        niveaux_distract: ['A1'],       tempsSecondes: 23 }, //  3
  { type: 'traduction-base',     nb_choix: 2, qualite: 'aleatoire',   niveaux_mot: ['A1','A2'],   niveaux_distract: ['A1'],       tempsSecondes: 22 }, //  4
  { type: 'traduction-base',     nb_choix: 2, qualite: 'aleatoire',   niveaux_mot: ['A1','A2'],   niveaux_distract: ['A1'],       tempsSecondes: 21 }, //  5
  { type: 'traduction-base',     nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['A1','A2'],   niveaux_distract: ['A1'],       tempsSecondes: 21 }, //  6
  { type: 'traduction-base',     nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['A2'],        niveaux_distract: ['A1'],       tempsSecondes: 20 }, //  7
  { type: 'traduction-base',     nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['A2'],        niveaux_distract: ['A1','A2'],  tempsSecondes: 19 }, //  8
  { type: 'traduction-base',     nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['A2','B1'],   niveaux_distract: ['A1','A2'],  tempsSecondes: 19 }, //  9
  { type: 'traduction-base',     nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['A2','B1'],   niveaux_distract: ['A2'],       tempsSecondes: 18 }, // 10
  { type: 'traduction-base',     nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['A2','B1'],   niveaux_distract: ['A2'],       tempsSecondes: 18 }, // 11
  { type: 'traduction-base',     nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['B1'],        niveaux_distract: ['A2'],       tempsSecondes: 17 }, // 12
  { type: 'traduction-base',     nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['B1'],        niveaux_distract: ['A2','B1'],  tempsSecondes: 17 }, // 13
  { type: 'traduction-contexte', nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['B1'],        niveaux_distract: ['A2','B1'],  tempsSecondes: 16 }, // 14
  { type: 'traduction-contexte', nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['B1'],        niveaux_distract: ['B1'],       tempsSecondes: 16 }, // 15
  { type: 'traduction-contexte', nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['B1','B2'],   niveaux_distract: ['B1'],       tempsSecondes: 15 }, // 16
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['B1','B2'],   niveaux_distract: ['B1'],       tempsSecondes: 15 }, // 17
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['B1','B2'],   niveaux_distract: ['B1'],       tempsSecondes: 14 }, // 18
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['B2'],        niveaux_distract: ['B1'],       tempsSecondes: 14 }, // 19
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['B2'],        niveaux_distract: ['B1','B2'],  tempsSecondes: 13 }, // 20
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'meme-theme',  niveaux_mot: ['B2'],        niveaux_distract: ['B1','B2'],  tempsSecondes: 13 }, // 21
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'meme-theme',  niveaux_mot: ['B2'],        niveaux_distract: ['B2'],       tempsSecondes: 12 }, // 22
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'meme-theme',  niveaux_mot: ['B2','C1'],   niveaux_distract: ['B2'],       tempsSecondes: 12 }, // 23
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'meme-theme',  niveaux_mot: ['B2','C1'],   niveaux_distract: ['B1','B2'],  tempsSecondes: 11 }, // 24
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-theme',  niveaux_mot: ['C1'],        niveaux_distract: ['B2'],       tempsSecondes: 11 }, // 25
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-theme',  niveaux_mot: ['C1'],        niveaux_distract: ['B2'],       tempsSecondes: 10 }, // 26
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-theme',  niveaux_mot: ['C1'],        niveaux_distract: ['B2','C1'],  tempsSecondes: 10 }, // 27
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-theme',  niveaux_mot: ['C1','C2'],   niveaux_distract: ['B2','C1'],  tempsSecondes:  9 }, // 28
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-classe', niveaux_mot: ['C1','C2'],   niveaux_distract: ['C1'],       tempsSecondes:  9 }, // 29
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-classe', niveaux_mot: ['C1','C2'],   niveaux_distract: ['C1'],       tempsSecondes:  9 }, // 30
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-classe', niveaux_mot: ['C1','C2'],   niveaux_distract: ['C1','C2'],  tempsSecondes:  8 }, // 31
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C1','C2'],  tempsSecondes:  8 }, // 32
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C1'],       tempsSecondes:  8 }, // 33
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C1','C2'],  tempsSecondes:  8 }, // 34
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C1','C2'],  tempsSecondes:  7 }, // 35
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C2'],       tempsSecondes:  7 }, // 36
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C2'],       tempsSecondes:  7 }, // 37
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C2'],       tempsSecondes:  7 }, // 38
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C2'],       tempsSecondes:  7 }, // 39
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C2'],       tempsSecondes:  7 }, // 40
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
  const niveau = Math.min(40, Math.max(1, Math.round(joueur.niveau)))
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
