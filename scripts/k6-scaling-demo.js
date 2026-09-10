/**
 * Scenario k6 - Demonstration de la mise a l'echelle horizontale
 *
 * Distinct de k6-load-test.js, et pour une raison de fond : la campagne
 * mensuelle qualifie la tenue du SLO sur les parcours reels d'un utilisateur,
 * tandis que ce scenario-ci sert a montrer que les HorizontalPodAutoscaler
 * font leur travail. Les deux ne visent pas les memes services.
 *
 * Trois services portent un autoscaler : auth-service, k8s-service et le
 * frontend. Ce sont eux, et eux seuls, qu'il faut charger.
 *
 * Le choix des routes n'est pas libre. La route /api/v1/auth porte une
 * limitation a vingt requetes par minute et par adresse : une campagne lancee
 * depuis une seule machine y recolterait des 429 sans jamais atteindre le
 * service. On passe donc par /api/v1/projects, servi par le meme auth-service
 * et sans limitation : chaque appel y valide le jeton, ce qui est precisement
 * la charge que l'autoscaler doit absorber.
 *
 * Usage : k6 run scripts/k6-scaling-demo.js
 */

import http from 'k6/http'
import { check } from 'k6'
import { Rate } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://kong:8000'
const EMAIL = __ENV.TEST_EMAIL || 'fabio@client.interne'
const PASSWORD = __ENV.TEST_PASSWORD || ''

const erreurs = new Rate('erreurs_applicatives')

export const options = {
  // Debit constant, et non nombre d'utilisateurs constant. La distinction est
  // decisive ici : la passerelle limite le trafic sur une fenetre fixe d'une
  // minute, si bien qu'une rafale passe en quelques secondes puis se fait
  // refuser jusqu'a la minute suivante. Le service recoit alors une dent de
  // scie, et l'autoscaler, qui moyenne ses mesures, ne voit qu'une charge
  // faible. En pilotant le debit, on reste sous le plafond et la charge est
  // reellement soutenue.
  //
  // Soixante-dix iterations par seconde valent deux cent dix requetes, sous les
  // cinq cents par seconde autorisees par la passerelle.
  scenarios: {
    montee: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 300,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '3m', target: 70 },
        { duration: '1m', target: 70 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    // Aucun seuil bloquant : ce scenario mesure la reaction de
    // l'infrastructure, pas la conformite au SLO. La campagne mensuelle s'en
    // charge, avec ses propres seuils.
    http_req_failed: ['rate<0.5'],
  },
}

// Une seule authentification pour toute la campagne : le jeton est ensuite
// reutilise par tous les utilisateurs virtuels. C'est aussi ce que fait un
// navigateur, et cela evite de heurter la limitation de la route d'auth.
export function setup() {
  const reponse = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  if (reponse.status !== 200) {
    throw new Error(`authentification impossible (HTTP ${reponse.status})`)
  }
  return { jeton: JSON.parse(reponse.body).token }
}

export default function (donnees) {
  const entetes = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${donnees.jeton}`,
  }

  // Frontend : le bundle servi par nginx, sans authentification. C'est le
  // service au plancher le plus bas, donc le premier a monter.
  const page = http.get(`${BASE_URL}/`)
  check(page, { 'interface servie': (r) => r.status === 200 })

  // auth-service : chaque appel valide le jeton avant de repondre.
  const projets = http.get(`${BASE_URL}/api/v1/projects`, { headers: entetes })
  erreurs.add(projets.status >= 500)

  // k8s-service : interroge l'API du cluster raccorde. C'est de loin l'appel le
  // plus couteux des trois, et c'est aussi celui que decrit le dimensionnement
  // du chart : la charge de ce service suit le nombre de tableaux de bord
  // ouverts. Une iteration equivaut donc a un ecran d'inventaire rafraichi.
  const ns = http.get(`${BASE_URL}/api/v1/k8s/namespaces`, { headers: entetes })
  erreurs.add(ns.status >= 500)

  // Pas de pause : c'est l'executeur qui cadence, pas le script.
}
