'use strict'

function chargerApprenants() {
  const raw = process.env.APPRENANTS || ''
  return raw.split(',')
    .map(n => n.trim())
    .filter(Boolean)
    .map(nom => ({ id: nom.toLowerCase().replace(/\s+/g, '-'), nom }))
}

function creerSession(slots, typeJeu = 'quiz', niveauDepart = 1) {
  const apprenants = chargerApprenants()
  const joueurs = slots.map(id => {
    const apprenant = apprenants.find(a => a.id === id)
    return {
      id,
      nomReel:             apprenant ? apprenant.nom : id,
      nomJeu:              null,
      socketId:            null,
      connecte:            false,
      score:               0,
      niveau:              niveauDepart,
      difficulteEnCours:   niveauDepart,
      tempsSecondesEnCours: 20,
      questionsVues:       new Set(),
      reponses:            [],
      erreurConsecutives:  0,
    }
  })
  return { typeJeu, etat: 'attente', joueurs, config: null, creeLe: Date.now() }
}

// Règles d'adaptation :
// - bonne réponse en ≤ 5s  → monte d'un niveau (max 10)
// - bonne réponse en > 5s  → reste au même niveau
// - 1 erreur               → reste au même niveau
// - 2 erreurs consécutives → descend d'un niveau (min 1), compteur remis à 0
function ajusterNiveau(joueur, correcte, tempsMsReponse) {
  if (correcte) {
    joueur.erreurConsecutives = 0
    if (tempsMsReponse <= 5000) joueur.niveau = Math.min(15, joueur.niveau + 1)
  } else {
    joueur.erreurConsecutives += 1
    if (joueur.erreurConsecutives >= 2) {
      joueur.niveau = Math.max(1, joueur.niveau - 1)
      joueur.erreurConsecutives = 0
    }
  }
}

function joueurRejoindre(session, id, socketId, nomJeu) {
  const joueur = session.joueurs.find(j => j.id === id)
  if (!joueur) return null
  joueur.socketId = socketId
  joueur.nomJeu   = nomJeu
  joueur.connecte = true
  return joueur
}

function joueurDeconnecter(session, id) {
  const joueur = session.joueurs.find(j => j.id === id)
  if (joueur) joueur.connecte = false
  return joueur
}

function tousConnectes(session) {
  return session.joueurs.every(j => j.connecte)
}

// vitesse relative au temps alloué pour la question :
//   répondre en début de timer → vitesse proche de 1 → bonus max
//   répondre en fin de timer   → vitesse proche de 0 → bonus nul
function enregistrerReponse(session, id, questionIndex, optionChoisie, correcte, tempsMsReponse, difficulte = 1, tempsSecondes = 10) {
  const joueur = session.joueurs.find(j => j.id === id)
  if (!joueur) return { score: 0, delta: 0 }
  joueur.reponses.push({ questionIndex, optionChoisie, correcte, tempsMsReponse })
  const scoreBefore = joueur.score
  if (correcte) {
    const vitesse = Math.max(0, 1 - tempsMsReponse / (tempsSecondes * 1000))
    joueur.score += Math.round((100 + 200 * vitesse) * difficulte)
  } else {
    joueur.score = Math.max(0, joueur.score - Math.round(400 * difficulte))
  }
  return { score: joueur.score, delta: joueur.score - scoreBefore }
}

function classement(session) {
  return [...session.joueurs]
    .sort((a, b) => b.score - a.score)
    .map((j, i) => ({
      position:   i + 1,
      nomJeu:     j.nomJeu,
      nomReel:    j.id,
      score:      j.score,
      niveau:     Math.round(j.niveau),
      nbReponses: j.reponses.length,
    }))
}

module.exports = { chargerApprenants, creerSession, ajusterNiveau, joueurRejoindre, joueurDeconnecter, tousConnectes, enregistrerReponse, classement }
