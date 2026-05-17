'use strict'
const { classement } = require('./session')

function demarrer(sessionActive, config, envoyerJoueur, diffuserATous, diffuserAuTeacher, callbackFin, genererQuestion) {
  const dureeMs = (config.dureeMinutes || 5) * 60 * 1000
  const finAt   = Date.now() + dureeMs

  // Première question pour chaque joueur connecté
  for (const joueur of sessionActive.joueurs) {
    if (!joueur.connecte) continue
    const q = genererQuestion(joueur, config.source)
    if (q) {
      joueur.difficulteEnCours = q.difficulte
      envoyerJoueur(joueur.id, 'question', q)
    }
  }

  // Compte à rebours global — tick toutes les secondes
  const tick = setInterval(() => {
    const resteSec = Math.max(0, Math.round((finAt - Date.now()) / 1000))
    diffuserATous('timer', { secondes: resteSec })
    diffuserAuTeacher('timer', { secondes: resteSec })
    if (resteSec <= 0) {
      clearInterval(tick)
      callbackFin(classement(sessionActive))
    }
  }, 1000)
}

module.exports = { demarrer }