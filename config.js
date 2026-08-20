// Rempli avec les infos de TON application créée sur https://developers.eveonline.com
// (voir le README pour la marche à suivre complète)
window.EVE_SSO_CONFIG = {
  CLIENT_ID: "COLLE_TON_CLIENT_ID_ICI",
  // Doit correspondre EXACTEMENT à l'URL "Callback" déclarée sur developers.eveonline.com
  // Ex : https://tonpseudo.github.io/relais-hypernet/callback.html
  CALLBACK_URL: "https://tonpseudo.github.io/relais-hypernet/callback.html",
  SCOPES: "esi-wallet.read_character_wallet.v1"
};
