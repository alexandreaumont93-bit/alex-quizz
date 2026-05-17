#!/usr/bin/env node
'use strict'
const WebSocket = require('ws')
const fs        = require('fs')
const path      = require('path')

const URL = process.argv[2] || 'ws://localhost:3001'

const date   = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
const fichier = path.join(__dirname, `quiz-${date}.jsonl`)
const log     = fs.createWriteStream(fichier, { flags: 'a' })

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  grey:   '\x1b[90m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
}

function ts() {
  return C.grey + new Date().toISOString().slice(11, 23) + C.reset
}

function afficher(evenement, donnees) {
  switch (evenement) {
    case 'observateur_ok':
      console.log(`${ts()} ${C.cyan}● observateur connecté${C.reset}`)
      break

    case 'question_generee': {
      const q = donnees.question
      const opts = q.options.map(o => (o.correcte ? C.green + '✓ ' : C.red + '✗ ') + o.texte + C.reset).join('  ')
      console.log(
        `${ts()} ${C.bold}${C.blue}Q${C.reset} ${C.bold}${donnees.joueur}${C.reset}` +
        `  lvl${C.yellow}${q.difficulte}${C.reset}` +
        `  ${C.magenta}${q.type}${C.reset}` +
        `  ${C.cyan}${q.mot}${C.reset}` +
        `  [${q.options.length} choix / ${q.tempsSecondes}s]`
      )
      if (q.contexte) console.log(`    ${C.grey}↳ ${q.contexte}${C.reset}`)
      console.log(`    ${opts}`)
      break
    }

    case 'reponse_recue': {
      const ok    = donnees.correcte
      const symb  = ok ? C.green + '✓' : C.red + '✗'
      const delta = donnees.delta >= 0 ? C.green + '+' + donnees.delta : C.red + donnees.delta
      const tps   = donnees.tempsMsReponse != null ? `${donnees.tempsMsReponse}ms` : '?'
      console.log(
        `${ts()} ${symb}${C.reset} ${C.bold}${donnees.joueur}${C.reset}` +
        `  "${donnees.optionChoisie}"` +
        `  ${delta}${C.reset} pts → total ${C.bold}${donnees.score}${C.reset}` +
        `  lvl${C.yellow}${donnees.niveau}${C.reset}` +
        `  [${tps} / ${donnees.nbReponses} rép.]`
      )
      break
    }

    case 'partie_terminee':
      console.log(`\n${ts()} ${C.bold}${C.yellow}★ PARTIE TERMINÉE${C.reset}`)
      if (donnees.classement) {
        donnees.classement.forEach((j, i) => {
          console.log(`  ${i + 1}. ${C.bold}${j.nomJeu || j.id}${C.reset}  ${j.score} pts  (${j.nbReponses} rép.)`)
        })
      }
      console.log()
      break

    case 'timer':
      // silencieux — trop fréquent
      break

    default:
      console.log(`${ts()} ${C.grey}${evenement}${C.reset}`, JSON.stringify(donnees).slice(0, 120))
  }
}

function connecter() {
  console.log(`${C.cyan}Connexion à ${URL}…${C.reset}`)
  const ws = new WebSocket(URL)

  ws.on('open', () => {
    ws.send(JSON.stringify({ evenement: 'observateur_connecte' }))
    console.log(`${C.cyan}Enregistrement en cours → ${fichier}${C.reset}\n`)
  })

  ws.on('message', (raw) => {
    let paquet
    try { paquet = JSON.parse(raw) } catch { return }
    const { ts: timestamp, evenement, donnees } = paquet
    log.write(JSON.stringify({ ts: timestamp || Date.now(), evenement, donnees }) + '\n')
    afficher(evenement, donnees)
  })

  ws.on('close', () => {
    console.log(`\n${C.red}Déconnecté. Reconnexion dans 3s…${C.reset}`)
    setTimeout(connecter, 3000)
  })

  ws.on('error', (err) => {
    console.error(`${C.red}Erreur : ${err.message}${C.reset}`)
  })
}

connecter()
