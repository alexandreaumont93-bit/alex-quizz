'use strict'

function chargerApprenants() {
  const raw = process.env.APPRENANTS || '';
  return raw.split(',')
    .map(n => n.trim())
    .filter(Boolean)
    .map(nom => ({ id: nom.toLowerCase().replace(/\s+/g, '-'), nom }));
}

function creerSession(slots, typeJeu = 'quiz') {
  const apprenants = chargerApprenants();
  const joueurs = slots.map(id => {
    const apprenant = apprenants.find(a => a.id === id);
    return { id, nomReel: apprenant ? apprenant.nom : id, nomJeu: null, socketId: null, connecte: false, score: 0, reponses: [] };
  });
  return { typeJeu, etat: 'attente', joueurs, questionActuelle: 0, creeLe: Date.now() };
}

function joueurRejoindre(session, id, socketId, nomJeu) {
  const joueur = session.joueurs.find(j => j.id === id);
  if (!joueur) return null;
  joueur.socketId = socketId;
  joueur.nomJeu = nomJeu;
  joueur.connecte = true;
  return joueur;
}

function joueurDeconnecter(session, socketId) {
  const joueur = session.joueurs.find(j => j.socketId === socketId);
  if (joueur) joueur.connecte = false;
  return joueur;
}

function joueurParSocket(session, socketId) {
  return session.joueurs.find(j => j.socketId === socketId) || null;
}

function tousConnectes(session) {
  return session.joueurs.every(j => j.connecte);
}

function enregistrerReponse(session, socketId, questionIndex, optionChoisie, correcte, tempsMsReponse) {
  const joueur = joueurParSocket(session, socketId);
  if (!joueur) return 0;
  joueur.reponses.push({ questionIndex, optionChoisie, correcte, tempsMsReponse });
  if (correcte) {
    const bonus = Math.round(500 + 500 * Math.max(0, 1 - tempsMsReponse / 15000));
    joueur.score += bonus;
  }
  return joueur.score;
}

function classement(session) {
  return [...session.joueurs]
    .sort((a, b) => b.score - a.score)
    .map((j, i) => ({ position: i + 1, nomJeu: j.nomJeu, nomReel: j.id, score: j.score, reponses: j.reponses }));
}

module.exports = { chargerApprenants, creerSession, joueurRejoindre, joueurDeconnecter, joueurParSocket, tousConnectes, enregistrerReponse, classement };
