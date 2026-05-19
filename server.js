'use strict'
const http = require('http')
const fs   = require('fs')
const path = require('path')
const os   = require('os')
const { WebSocketServer } = require('ws')
const session    = require('./session')
const renduJeu   = require('./rendu')
const generateur = require('./generateur')
const dico       = require('./dictionnaires')

const PORT       = parseInt(process.env.PORT || '3001', 10)
const PUBLIC_DIR = path.join(__dirname, 'public')

const TYPES_CONTENU = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
}

function getLocalIP() {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address
    }
  }
  return 'localhost'
}

const serveur = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/infos') {
    const host = process.env.RENDER_EXTERNAL_URL || `http://${getLocalIP()}:${PORT}`
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ url: host }))
    return
  }
  if (req.method === 'GET' && req.url === '/api/observer') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ actif: wsObservateurs.size > 0 }))
    return
  }
  if (req.method === 'GET' && req.url === '/api/dictionnaires') {
    const dicos = dico.lister()
    const total = dicos.reduce((s, d) => s + d.entrees, 0)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify([{ nom: 'tous', entrees: total }, ...dicos]))
    return
  }
  const fichier = req.url === '/' ? '/rejoindre.html' : req.url
  const chemin  = path.join(PUBLIC_DIR, fichier)
  if (!fs.existsSync(chemin)) { res.writeHead(404); res.end('Non trouvé'); return }
  res.writeHead(200, { 'Content-Type': TYPES_CONTENU[path.extname(chemin)] || 'text/plain' })
  fs.createReadStream(chemin).pipe(res)
})

const wss = new WebSocketServer({ server: serveur })

let sessionActive  = null
let wsTeacher      = null
const wsJoueurs    = new Map()
const joueursPrets = new Map()
const wsObservateurs = new Set()

function envoyer(ws, evenement, donnees = {}) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify({ evenement, donnees }))
}
function envoyerJoueur(id, evenement, donnees = {}) {
  envoyer(wsJoueurs.get(id), evenement, donnees)
}
function diffuserATous(evenement, donnees = {}) {
  wsJoueurs.forEach(ws => envoyer(ws, evenement, donnees))
}
function diffuserAuTeacher(evenement, donnees = {}) {
  envoyer(wsTeacher, evenement, donnees)
}
function diffuserAuxObservateurs(evenement, donnees = {}) {
  const msg = JSON.stringify({ ts: Date.now(), evenement, donnees })
  wsObservateurs.forEach(ws => { if (ws.readyState === ws.OPEN) ws.send(msg) })
}
function lobbyJoueurs() {
  if (!sessionActive) return []
  return sessionActive.joueurs.filter(j => j.connecte).map(j => ({ nomJeu: j.nomJeu }))
}

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    let paquet
    try { paquet = JSON.parse(msg) } catch { return }
    const { evenement, donnees = {} } = paquet

    switch (evenement) {

      case 'teacher_connecte':
        wsTeacher = ws
        envoyer(ws, 'apprenants_disponibles', { apprenants: session.chargerApprenants() })
        joueursPrets.forEach((j, id) => {
          diffuserAuTeacher('apprenant_pret', { id, nomReel: j.nomReel, nomJeu: j.nomJeu })
        })
        break

      case 'observateur_connecte':
        wsObservateurs.add(ws)
        ws._observateur = true
        envoyer(ws, 'observateur_ok', { message: 'connecté' })
        break

      case 'demander_apprenants':
        envoyer(ws, 'apprenants_disponibles', { apprenants: session.chargerApprenants() })
        break

      case 'configurer_session': {
        const niveauDepart     = donnees.niveauDepart || 1
        const niveauxParJoueur = donnees.niveauxParJoueur || {}
        sessionActive = session.creerSession(donnees.slots, donnees.typeJeu, niveauDepart, niveauxParJoueur)
        envoyer(ws, 'session_creee', {
          joueurs: sessionActive.joueurs.map(j => ({ id: j.id, nomReel: j.nomReel, connecte: false, niveauDepart: j.niveau }))
        })
        for (const joueur of sessionActive.joueurs) {
          const pret = joueursPrets.get(joueur.id)
          if (!pret) continue
          session.joueurRejoindre(sessionActive, joueur.id, joueur.id, pret.nomJeu)
          wsJoueurs.set(joueur.id, pret.ws)
          pret.ws._enSession = true
          envoyer(pret.ws, 'session_ok', { nomJeu: pret.nomJeu, joueurs: lobbyJoueurs() })
          diffuserAuTeacher('joueur_connecte', { id: joueur.id, nomReel: joueur.nomReel, nomJeu: pret.nomJeu })
        }
        wsJoueurs.forEach(ws2 => envoyer(ws2, 'lobby_update', { joueurs: lobbyJoueurs() }))
        if (session.tousConnectes(sessionActive)) diffuserAuTeacher('tous_connectes', {})
        break
      }

      case 'rejoindre': {
        const apprenants = session.chargerApprenants()
        const apprenant  = apprenants.find(a => a.id === donnees.id)
        if (!apprenant) { envoyer(ws, 'erreur', { message: 'Prénom non reconnu.' }); break }

        ws._joueurId = donnees.id
        joueursPrets.set(donnees.id, { ws, nomJeu: donnees.nomJeu, nomReel: apprenant.nom })
        diffuserAuTeacher('apprenant_pret', { id: donnees.id, nomReel: apprenant.nom, nomJeu: donnees.nomJeu })

        if (!sessionActive) { envoyer(ws, 'en_attente_ok', { nomJeu: donnees.nomJeu }); break }

        const joueur = sessionActive.joueurs.find(j => j.id === donnees.id)
        if (!joueur) { envoyer(ws, 'en_attente_ok', { nomJeu: donnees.nomJeu }); break }

        session.joueurRejoindre(sessionActive, donnees.id, donnees.id, donnees.nomJeu)
        wsJoueurs.set(donnees.id, ws)
        ws._enSession = true
        envoyer(ws, 'session_ok', { nomJeu: donnees.nomJeu, joueurs: lobbyJoueurs(), score: joueur.score || 0 })

        // Si la partie est déjà en cours, lui envoyer sa première question
        if (sessionActive.etat === 'en-cours') {
          const q = generateur.genererPourJoueur(joueur, sessionActive.config.source)
          if (q) {
            joueur.difficulteEnCours    = q.difficulte
            joueur.tempsSecondesEnCours = q.tempsSecondes
            joueur.questionEnCours      = q
            envoyer(ws, 'question', q)
            diffuserAuxObservateurs('question_generee', { joueur: joueur.nomJeu || joueur.id, question: q })
          }
        }

        wsJoueurs.forEach(ws2 => envoyer(ws2, 'lobby_update', { joueurs: lobbyJoueurs() }))
        diffuserAuTeacher('joueur_connecte', { id: joueur.id, nomReel: joueur.nomReel, nomJeu: donnees.nomJeu })
        if (session.tousConnectes(sessionActive)) diffuserAuTeacher('tous_connectes', {})
        break
      }

      case 'lancer_jeu': {
        if (!sessionActive || sessionActive.etat !== 'attente') break
        sessionActive.etat = 'en-cours'
        const source        = donnees.source || dico.lister()[0]?.nom || 'giono_homme_arbres'
        const dureeMinutes  = donnees.dureeMinutes || 5
        sessionActive.config = { source, dureeMinutes }

        const genererEtObserver = (joueur, src) => {
          const q = generateur.genererPourJoueur(joueur, src)
          if (q) {
            joueur.questionEnCours = q
            const payload = { joueur: joueur.nomJeu || joueur.id, question: q }
            diffuserAuxObservateurs('question_generee', payload)
            diffuserAuTeacher('question_generee', payload)
          }
          return q
        }

        renduJeu.demarrer(
          sessionActive,
          { source, dureeMinutes },
          envoyerJoueur,
          diffuserATous,
          diffuserAuTeacher,
          (classement) => {
            sessionActive.etat = 'termine'
            diffuserATous('partie_terminee', { classement })
            diffuserAuTeacher('partie_terminee', { classement })
            diffuserAuxObservateurs('partie_terminee', { classement })
          },
          genererEtObserver
        )
        break
      }

      case 'repondre': {
        if (!sessionActive || !ws._joueurId || sessionActive.etat !== 'en-cours') break
        const j = sessionActive.joueurs.find(p => p.id === ws._joueurId)
        if (!j) break

        const difficulte    = j.difficulteEnCours   || 1
        const tempsSecondes = j.tempsSecondesEnCours || 10
        const estBoss       = j.questionEstBoss || false
        const niveauAvant   = Math.round(j.niveau)

        const { score, delta, streak } = session.enregistrerReponse(
          sessionActive, j.id,
          donnees.questionIndex, donnees.optionChoisie,
          donnees.correcte, donnees.tempsMsReponse,
          difficulte, tempsSecondes, estBoss
        )
        session.ajusterNiveau(j, donnees.correcte, donnees.tempsMsReponse)

        const niveauApres = Math.round(j.niveau)
        const levelUp     = niveauApres > niveauAvant

        // Rang du joueur (par score décroissant)
        const scores = sessionActive.joueurs.map(p => p.score).sort((a, b) => b - a)
        const rang   = scores.indexOf(score) + 1

        envoyer(ws, 'score_update', { score, delta, correcte: donnees.correcte, streak, rang, levelUp, niveau: niveauApres, estBoss })

        // Si mauvaise réponse → sabotage : secoue les autres joueurs
        if (!donnees.correcte) {
          wsJoueurs.forEach((wsJ, idJ) => {
            if (idJ !== j.id) envoyer(wsJ, 'perturber', { par: j.nomJeu || j.id })
          })
        }

        diffuserAuTeacher('reponse_recue', {
          nomJeu:     j.nomJeu,
          correcte:   donnees.correcte,
          score,
          niveau:     niveauApres,
          nbReponses: j.reponses.length,
          streak,
        })

        diffuserAuxObservateurs('reponse_recue', {
          joueur:         j.nomJeu || j.id,
          correcte:       donnees.correcte,
          optionChoisie:  donnees.optionChoisie,
          tempsMsReponse: donnees.tempsMsReponse,
          delta,
          score,
          niveau:         niveauApres,
          nbReponses:     j.reponses.length,
          streak,
          question:       j.questionEnCours || null,
        })

        // Question suivante immédiatement
        const prochainIndex = j.reponses.length
        const estProchainBoss = prochainIndex > 0 && prochainIndex % 10 === 0
        const q = generateur.genererPourJoueur(j, sessionActive.config.source)
        if (q) {
          j.difficulteEnCours  = q.difficulte
          j.tempsSecondesEnCours = q.tempsSecondes
          j.questionEnCours    = q
          j.questionEstBoss    = estProchainBoss
          if (estProchainBoss) q.estBoss = true
          envoyer(ws, 'question', q)
          const payload2 = { joueur: j.nomJeu || j.id, question: q }
          diffuserAuxObservateurs('question_generee', payload2)
          diffuserAuTeacher('question_generee', payload2)
        }
        break
      }
    }
  })

  ws.on('close', () => {
    if (ws === wsTeacher) { wsTeacher = null; return }
    if (ws._observateur) { wsObservateurs.delete(ws); return }
    const id = ws._joueurId
    if (!id) return
    joueursPrets.delete(id)
    wsJoueurs.delete(id)
    if (sessionActive) session.joueurDeconnecter(sessionActive, id)
    diffuserAuTeacher('joueur_deconnecte', { id })
  })
})

serveur.listen(PORT, () => console.log(`Quiz lancé → http://localhost:${PORT}`))
