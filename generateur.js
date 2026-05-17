'use strict'
const dico = require('./dictionnaires')
const { genererUne } = require('./questions')

// niveau 1-40 → 5 dimensions : type · nb_choix · qualité distracteurs · CECR mot · CECR distracteurs · temps (s)
// Chaque niveau change 1-2 dimensions max pour une progression graduelle.
// seuil_cognate : similitude max tolérée entre le mot FR et sa traduction EN (1=pas de filtre, 0.3=très strict)
// Progression : niveaux bas → cognates autorisés (reconnaissance visuelle aide les débutants)
//               niveaux hauts → seuls les vrais non-cognates sont posés (on ne peut plus tricher visuellement)
const PRESETS = [
  null,
  { type: 'traduction-base',     nb_choix: 2, qualite: 'aleatoire',   niveaux_mot: ['A1'],        niveaux_distract: null,         tempsSecondes: 25, seuil_cognate: 1.00 }, //  1
  { type: 'traduction-base',     nb_choix: 2, qualite: 'aleatoire',   niveaux_mot: ['A1'],        niveaux_distract: null,         tempsSecondes: 24, seuil_cognate: 1.00 }, //  2
  { type: 'traduction-base',     nb_choix: 2, qualite: 'aleatoire',   niveaux_mot: ['A1'],        niveaux_distract: ['A1'],       tempsSecondes: 23, seuil_cognate: 1.00 }, //  3
  { type: 'traduction-base',     nb_choix: 2, qualite: 'aleatoire',   niveaux_mot: ['A1','A2'],   niveaux_distract: ['A1'],       tempsSecondes: 22, seuil_cognate: 1.00 }, //  4
  { type: 'traduction-base',     nb_choix: 2, qualite: 'aleatoire',   niveaux_mot: ['A1','A2'],   niveaux_distract: ['A1'],       tempsSecondes: 21, seuil_cognate: 1.00 }, //  5
  { type: 'traduction-base',     nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['A1','A2'],   niveaux_distract: ['A1'],       tempsSecondes: 21, seuil_cognate: 1.00 }, //  6
  { type: 'traduction-base',     nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['A2'],        niveaux_distract: ['A1'],       tempsSecondes: 20, seuil_cognate: 1.00 }, //  7
  { type: 'traduction-base',     nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['A2'],        niveaux_distract: ['A1','A2'],  tempsSecondes: 19, seuil_cognate: 0.90 }, //  8
  { type: 'traduction-base',     nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['A2','B1'],   niveaux_distract: ['A1','A2'],  tempsSecondes: 19, seuil_cognate: 0.90 }, //  9
  { type: 'traduction-base',     nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['A2','B1'],   niveaux_distract: ['A2'],       tempsSecondes: 18, seuil_cognate: 0.90 }, // 10
  { type: 'traduction-base',     nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['A2','B1'],   niveaux_distract: ['A2'],       tempsSecondes: 18, seuil_cognate: 0.90 }, // 11
  { type: 'traduction-base',     nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['B1'],        niveaux_distract: ['A2'],       tempsSecondes: 17, seuil_cognate: 0.90 }, // 12
  { type: 'traduction-base',     nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['B1'],        niveaux_distract: ['A2','B1'],  tempsSecondes: 17, seuil_cognate: 0.75 }, // 13
  { type: 'traduction-contexte', nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['B1'],        niveaux_distract: ['A2','B1'],  tempsSecondes: 16, seuil_cognate: 0.75 }, // 14
  { type: 'traduction-contexte', nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['B1'],        niveaux_distract: ['B1'],       tempsSecondes: 16, seuil_cognate: 0.75 }, // 15
  { type: 'traduction-contexte', nb_choix: 3, qualite: 'aleatoire',   niveaux_mot: ['B1','B2'],   niveaux_distract: ['B1'],       tempsSecondes: 15, seuil_cognate: 0.75 }, // 16
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['B1','B2'],   niveaux_distract: ['B1'],       tempsSecondes: 15, seuil_cognate: 0.75 }, // 17
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['B1','B2'],   niveaux_distract: ['B1'],       tempsSecondes: 14, seuil_cognate: 0.75 }, // 18
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['B2'],        niveaux_distract: ['B1'],       tempsSecondes: 14, seuil_cognate: 0.60 }, // 19
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'aleatoire',   niveaux_mot: ['B2'],        niveaux_distract: ['B1','B2'],  tempsSecondes: 13, seuil_cognate: 0.60 }, // 20
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'meme-theme',  niveaux_mot: ['B2'],        niveaux_distract: ['B1','B2'],  tempsSecondes: 13, seuil_cognate: 0.60 }, // 21
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'meme-theme',  niveaux_mot: ['B2'],        niveaux_distract: ['B2'],       tempsSecondes: 12, seuil_cognate: 0.60 }, // 22
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'meme-theme',  niveaux_mot: ['B2','C1'],   niveaux_distract: ['B2'],       tempsSecondes: 12, seuil_cognate: 0.60 }, // 23
  { type: 'traduction-contexte', nb_choix: 4, qualite: 'meme-theme',  niveaux_mot: ['B2','C1'],   niveaux_distract: ['B1','B2'],  tempsSecondes: 11, seuil_cognate: 0.60 }, // 24
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-theme',  niveaux_mot: ['C1'],        niveaux_distract: ['B2'],       tempsSecondes: 11, seuil_cognate: 0.50 }, // 25
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-theme',  niveaux_mot: ['C1'],        niveaux_distract: ['B2'],       tempsSecondes: 10, seuil_cognate: 0.50 }, // 26
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-theme',  niveaux_mot: ['C1'],        niveaux_distract: ['B2','C1'],  tempsSecondes: 10, seuil_cognate: 0.50 }, // 27
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-theme',  niveaux_mot: ['C1','C2'],   niveaux_distract: ['B2','C1'],  tempsSecondes:  9, seuil_cognate: 0.50 }, // 28
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-classe', niveaux_mot: ['C1','C2'],   niveaux_distract: ['C1'],       tempsSecondes:  9, seuil_cognate: 0.50 }, // 29
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-classe', niveaux_mot: ['C1','C2'],   niveaux_distract: ['C1'],       tempsSecondes:  9, seuil_cognate: 0.50 }, // 30
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-classe', niveaux_mot: ['C1','C2'],   niveaux_distract: ['C1','C2'],  tempsSecondes:  8, seuil_cognate: 0.40 }, // 31
  { type: 'traduction-contexte', nb_choix: 5, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C1','C2'],  tempsSecondes:  8, seuil_cognate: 0.40 }, // 32
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C1'],       tempsSecondes:  8, seuil_cognate: 0.40 }, // 33
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C1','C2'],  tempsSecondes:  8, seuil_cognate: 0.40 }, // 34
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C1','C2'],  tempsSecondes:  7, seuil_cognate: 0.30 }, // 35
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C2'],       tempsSecondes:  7, seuil_cognate: 0.30 }, // 36
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C2'],       tempsSecondes:  7, seuil_cognate: 0.30 }, // 37
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C2'],       tempsSecondes:  7, seuil_cognate: 0.30 }, // 38
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C2'],       tempsSecondes:  7, seuil_cognate: 0.30 }, // 39
  { type: 'traduction-contexte', nb_choix: 6, qualite: 'meme-classe', niveaux_mot: ['C2'],        niveaux_distract: ['C2'],       tempsSecondes:  7, seuil_cognate: 0.30 }, // 40
]

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
  const preset = PRESETS[niveau]

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
    question.index        = joueur.reponses.length
    question.tempsDebut   = Date.now()
    question.tempsSecondes = preset.tempsSecondes
    question.difficulte   = niveau
  }

  return question
}

module.exports = { genererPourJoueur, chargerSource }
