const { classement } = require('./session')

const DUREE_QUESTION_MS = 15000;
const PAUSE_MS = 3000;

function pause(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function timerQuestion(dureeMs, diffuserATous, diffuserAuTeacher) {
  return new Promise(resolve => {
    let secondes = Math.round(dureeMs / 1000);
    const envoyer = () => {
      diffuserATous('timer', { secondes });
      diffuserAuTeacher('timer', { secondes });
    };
    envoyer();
    secondes--;
    const tick = setInterval(() => {
      envoyer();
      secondes--;
      if (secondes < 0) { clearInterval(tick); resolve(); }
    }, 1000);
  });
}

async function demarrer(sessionActive, donnees, diffuserATous, diffuserAuTeacher, callbackFin, getQuestions, logguer) {
  const nbQuestions = donnees.nbQuestions || 10;

  const questions = getQuestions(nbQuestions);
  if (questions.length === 0) {
    diffuserAuTeacher('statut', { message: "Aucune question acceptée dans le pool." });
    return;
  }

  for (let i = 0; i < questions.length; i++) {
    const question = { ...questions[i], index: i, tempsDebut: Date.now() };

    diffuserATous('question', question);
    diffuserAuTeacher('question', question);

    await timerQuestion(DUREE_QUESTION_MS, diffuserATous, diffuserAuTeacher);

    const indexCorrect = question.options.findIndex(o => o.correcte);
    diffuserATous('fin_question', { indexCorrect });
    diffuserAuTeacher('fin_question', { indexCorrect });

    await pause(PAUSE_MS);
  }

  if (logguer) logguer(sessionActive, questions);
  callbackFin(classement(sessionActive));
}

module.exports = { demarrer };
