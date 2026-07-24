// Pont vers le contexte de la VRAIE page Instagram (une fenetre Electron cachee,
// deja authentifiee, sur https://www.instagram.com/).
//
// Pourquoi ? Les LECTURES (fil, DM, profil) passent tres bien depuis Node avec
// les cookies + en-tetes captures. Mais les ECRITURES (envoi de message) sont
// systematiquement renvoyees vers /accounts/login : Instagram exige sur les
// mutations le signal same-origin du navigateur (en-tetes Sec-Fetch-Site:
// same-origin, Sec-Fetch-Mode: cors...) que Node ne peut PAS falsifier de
// maniere convaincante (ce sont des « forbidden headers » gerees par le
// navigateur lui-meme). En executant l'envoi DANS la page, c'est le navigateur
// qui ajoute ces en-tetes : la requete est authentiquement same-origin.
//
// C'est exactement la technique qui rend la capture du profil infaillible :
// on execute du JS dans la page reelle plutot que de rejouer une requete depuis
// Node. electron/main.cjs enregistre ici la fonction d'envoi ; web-ig.cjs
// l'utilise en priorite pour les envois, avec repli sur la requete serveur.
let sender = null
let fetcher = null

module.exports = {
  // Appele par le process principal Electron une fois la fenetre worker prete.
  setSender(fn) {
    sender = typeof fn === 'function' ? fn : null
    console.log(`[page-bridge] envoi via la page Instagram ${sender ? 'active' : 'desactive'}`)
  },
  hasSender() {
    return typeof sender === 'function'
  },
  // threadId : string ; text : string ; writeHeaders : en-tetes x-* a rejouer.
  // Renvoie l'objet brut produit dans la page ({ ok, status, data, ... }).
  async send(threadId, text, writeHeaders) {
    if (!sender) throw new Error('page bridge indisponible')
    return sender(threadId, text, writeHeaders || {})
  },

  // Lecture GET executee DANS la page (pour les endpoints qu'Instagram refuse
  // a une requete Node mais accepte depuis son propre contexte, ex : news/inbox).
  setFetcher(fn) {
    fetcher = typeof fn === 'function' ? fn : null
  },
  hasFetcher() {
    return typeof fetcher === 'function'
  },
  async get(path) {
    if (!fetcher) throw new Error('page bridge (get) indisponible')
    return fetcher(path)
  },
}
