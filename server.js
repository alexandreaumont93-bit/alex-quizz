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

let sessionActive    = null;
let wsTeacher        = null;
const wsJoueurs      = new Map(); // id → ws (joueurs dans la session)
const joueursPrets   = new Map(); // id → { ws, nomJeu, nomReel } (connectés, pas encore en session)
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
function lobbyJoueurs() {
  if (!sessionActive) return [];
  return sessionActive.joueurs.filter(j => j.connecte).map(j => ({ nomJeu: j.nomJeu }));
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
        // Envoyer les apprenants déjà connectés en attente
        joueursPrets.forEach((j, id) => {
          diffuserAuTeacher('apprenant_pret', { id, nomReel: j.nomReel, nomJeu: j.nomJeu });
        });
        break;

      case 'demander_apprenants':
        envoyer(ws, 'apprenants_disponibles', { apprenants: session.chargerApprenants() });
        break;

      case 'configurer_session': {
        sessionActive = session.creerSession(donnees.slots, donnees.typeJeu);
        envoyer(ws, 'session_creee', {
          joueurs: sessionActive.joueurs.map(j => ({ id: j.id, nomReel: j.nomReel, connecte: false }))
        });
        // Connecter automatiquement les apprenants déjà en salle d'attente
        for (const joueur of sessionActive.joueurs) {
          const pret = joueursPrets.get(joueur.id);
          if (!pret) continue;
          session.joueurRejoindre(sessionActive, joueur.id, joueur.id, pret.nomJeu);
          wsJoueurs.set(joueur.id, pret.ws);
          pret.ws._enSession = true;
          envoyer(pret.ws, 'session_ok', { nomJeu: pret.nomJeu, joueurs: lobbyJoueurs() });
          diffuserAuTeacher('joueur_connecte', { id: joueur.id, nomReel: joueur.nomReel, nomJeu: pret.nomJeu });
        }
        wsJoueurs.forEach(ws2 => envoyer(ws2, 'lobby_update', { joueurs: lobbyJoueurs() }));
        if (session.tousConnectes(sessionActive)) diffuserAuTeacher('tous_connectes', {});
        break;
      }

      case 'rejoindre': {
        const apprenants = session.chargerApprenants();
        const apprenant  = apprenants.find(a => a.id === donnees.id);
        if (!apprenant) { envoyer(ws, 'erreur', { message: 'Prénom non reconnu.' }); break; }

        ws._joueurId = donnees.id;
        joueursPrets.set(donnees.id, { ws, nomJeu: donnees.nomJeu, nomReel: apprenant.nom });
        diffuserAuTeacher('apprenant_pret', { id: donnees.id, nomReel: apprenant.nom, nomJeu: donnees.nomJeu });

        // Pas de session → salle d'attente
        if (!sessionActive) {
          envoyer(ws, 'en_attente_ok', { nomJeu: donnees.nomJeu });
          break;
        }

        // Session active → vérifier si cet apprenant est dedans
        const joueur = sessionActive.joueurs.find(j => j.id === donnees.id);
        if (!joueur) {
          envoyer(ws, 'en_attente_ok', { nomJeu: donnees.nomJeu });
          break;
        }

        // Dans la session → connexion normale
        session.joueurRejoindre(sessionActive, donnees.id, donnees.id, donnees.nomJeu);
        wsJoueurs.set(donnees.id, ws);
        ws._enSession = true;
        envoyer(ws, 'session_ok', { nomJeu: donnees.nomJeu, joueurs: lobbyJoueurs() });
        if (sessionActive.etat === 'en-cours' && questionCourante) envoyer(ws, 'question', questionCourante);
        wsJoueurs.forEach(ws2 => envoyer(ws2, 'lobby_update', { joueurs: lobbyJoueurs() }));
        diffuserAuTeacher('joueur_connecte', { id: joueur.id, nomReel: joueur.nomReel, nomJeu: donnees.nomJeu });
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
    const id = ws._joueurId;
    if (!id) return;
    joueursPrets.delete(id);
    wsJoueurs.delete(id);
    if (sessionActive) session.joueurDeconnecter(sessionActive, id);
    diffuserAuTeacher('joueur_deconnecte', { id });
  });
});

serveur.listen(PORT, () => console.log(`Quiz lancé → http://localhost:${PORT}`));
