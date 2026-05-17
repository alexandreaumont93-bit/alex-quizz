'use strict'
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { WebSocketServer } = require('ws');
const session = require('./session');
const renduJeu = require('./rendu');
const pool     = require('./pool');

const PORT       = parseInt(process.env.PORT || '3001', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');

const TYPES_CONTENU = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
};

function getLocalIP() {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return 'localhost';
}

const serveur = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/infos') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const host = process.env.RENDER_EXTERNAL_URL || `http://${getLocalIP()}:${PORT}`;
    res.end(JSON.stringify({ url: host }));
    return;
  }

  const fichier = req.url === '/' ? '/rejoindre.html' : req.url;
  const chemin  = path.join(PUBLIC_DIR, fichier);
  if (!fs.existsSync(chemin)) { res.writeHead(404); res.end('Non trouvé'); return; }
  res.writeHead(200, { 'Content-Type': TYPES_CONTENU[path.extname(chemin)] || 'text/plain' });
  fs.createReadStream(chemin).pipe(res);
});

const wss = new WebSocketServer({ server: serveur });

let sessionActive = null;
let wsTeacher     = null;
const wsJoueurs   = new Map();
let questionCourante = null;

function envoyer(ws, evenement, donnees = {}) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify({ evenement, donnees }));
}
function diffuserATous(evenement, donnees = {}) {
  if (evenement === 'question') questionCourante = donnees;
  wsJoueurs.forEach(ws => envoyer(ws, evenement, donnees));
}
function diffuserAuTeacher(evenement, donnees = {}) {
  envoyer(wsTeacher, evenement, donnees);
}

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    let paquet;
    try { paquet = JSON.parse(msg); } catch { return; }
    const { evenement, donnees = {} } = paquet;

    switch (evenement) {
      case 'teacher_connecte':
        wsTeacher = ws;
        envoyer(ws, 'apprenants_disponibles', { apprenants: session.chargerApprenants() });
        break;

      case 'demander_apprenants':
        envoyer(ws, 'apprenants_disponibles', { apprenants: session.chargerApprenants() });
        break;

      case 'configurer_session':
        sessionActive = session.creerSession(donnees.slots, donnees.typeJeu);
        envoyer(ws, 'session_creee', { joueurs: sessionActive.joueurs.map(j => ({ id: j.id, nomReel: j.nomReel, connecte: false })) });
        break;

      case 'rejoindre': {
        if (!sessionActive) { envoyer(ws, 'erreur', { message: 'Pas de session active — attends que l\'enseignant crée la partie.' }); break; }
        const joueur = session.joueurRejoindre(sessionActive, donnees.id, donnees.id, donnees.nomJeu);
        if (!joueur) { envoyer(ws, 'erreur', { message: 'Prénom non reconnu dans cette session.' }); break; }
        ws._joueurId = donnees.id;
        wsJoueurs.set(donnees.id, ws);
        const lobbyJoueurs = () => sessionActive.joueurs.filter(j => j.connecte).map(j => ({ nomJeu: j.nomJeu }));
        envoyer(ws, 'session_ok', { nomJeu: joueur.nomJeu, nomReel: joueur.nomReel, joueurs: lobbyJoueurs() });
        if (sessionActive.etat === 'en-cours' && questionCourante) envoyer(ws, 'question', questionCourante);
        wsJoueurs.forEach(ws2 => envoyer(ws2, 'lobby_update', { joueurs: lobbyJoueurs() }));
        diffuserAuTeacher('joueur_connecte', { id: joueur.id, nomReel: joueur.nomReel, nomJeu: joueur.nomJeu });
        if (session.tousConnectes(sessionActive)) diffuserAuTeacher('tous_connectes', {});
        break;
      }

      case 'lancer_jeu':
        if (!sessionActive || sessionActive.etat !== 'attente') break;
        sessionActive.etat = 'en-cours';
        renduJeu.demarrer(sessionActive, donnees, diffuserATous, diffuserAuTeacher, (classement) => {
          sessionActive.etat = 'termine';
          const resultats = { classement };
          diffuserATous('partie_terminee', resultats);
          diffuserAuTeacher('partie_terminee', resultats);
        }, pool.piocherAcceptees, null);
        break;

      case 'repondre': {
        if (!sessionActive || !ws._joueurId) break;
        const j = sessionActive.joueurs.find(p => p.id === ws._joueurId);
        if (!j) break;
        const scoreActuel = session.enregistrerReponse(sessionActive, j.id, donnees.questionIndex, donnees.optionChoisie, donnees.correcte, donnees.tempsMsReponse);
        diffuserAuTeacher('reponse_recue', { nomJeu: j.nomJeu, correcte: donnees.correcte, score: scoreActuel });
        break;
      }
    }
  });

  ws.on('close', () => {
    if (ws === wsTeacher) { wsTeacher = null; return; }
    if (ws._joueurId) {
      wsJoueurs.delete(ws._joueurId);
      if (sessionActive) session.joueurDeconnecter(sessionActive, ws._joueurId);
      diffuserAuTeacher('joueur_deconnecte', { id: ws._joueurId });
    }
  });
});

serveur.listen(PORT, () => console.log(`Quiz lancé → http://localhost:${PORT}`));
