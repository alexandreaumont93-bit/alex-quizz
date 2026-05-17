'use strict'

function chargerApprenants() {
  const raw = process.env.APPRENANTS || ''
  return raw.split(',')
    .map(n => n.trim())
    .filter(Boolean)
    .map(nom => ({ id: nom.toLowerCase().replace(/\s+/g, '-'), nom }))
}

function creerSession(slots, typeJeu = 'quiz', niveauDepart = 3) {
  const apprenants = chargerApprenants()
  const joueurs = slots.map(id => {
    const apprenant = apprenants.find(a => a.id === id)
    return {
      id,
      nomReel:          apprenant ? apprenant.nom : id,
      nomJeu:           null,
      socketId:         null,
      connecte:         false,
      score:            0,
      niveau:           niveauDepart,
      difficulteEnCours: niveauDepart,
      questionsVues:    new Set(),
      reponses:         [],
    }
  })
  return { typeJeu, etat: 'attente', joueurs, config: null, creeLe: Date.now() }
}

function ajusterNiveau(joueur, correcte) {
  joueur.niveau = Math.min(7, Math.max(1, joueur.niveau + (correcte ? 1 : -1)))
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

function enregistrerReponse(session, id, questionIndex, optionChoisie, correcte, tempsMsReponse, difficulte = 1) {
  const joueur = session.joueurs.find(j => j.id === id)
  if (!joueur) return 0
  joueur.reponses.push({ questionIndex, optionChoisie, correcte, tempsMsReponse })
  if (correcte) {
    const base = Math.round(500 + 500 * Math.max(0, 1 - tempsMsReponse / 15000))
    joueur.score += base * difficulte
  }
  return joueur.score
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