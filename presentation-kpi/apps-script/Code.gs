/**
 * Présentation KPI : connexion entre le Google Sheet et l'application.
 * Version 3 : envoie simplement le contenu de la feuille « Donnée » (et les dates de « KPI OTD »,
 * l'OTD mensuel de « Point mensuel »). Le script n'écrit rien et ne modifie aucune feuille.
 *
 * Installation :
 *   1. Extensions > Apps Script : coller ce code à la place de l'ancien, enregistrer (Ctrl+S).
 *   2. Déployer > Gérer les déploiements > crayon > Version : « Nouvelle version » > Déployer.
 *      (Première fois : Déployer > Nouveau déploiement > Application Web, Exécuter en tant que : Moi,
 *       Accès : Tout le monde.)
 *   3. Dans l'application, menu « Données » : coller l'URL et la clé.
 *      La clé s'affiche avec le menu « Présentation KPI » > « Afficher la clé de connexion ».
 */

var VERSION = 3;
var FEUILLES = ['Donnée', 'KPI OTD', 'Point mensuel'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Présentation KPI')
    .addItem('Afficher la clé de connexion', 'afficherCle')
    .addToUi();
}

function afficherCle() {
  SpreadsheetApp.getUi().alert(
    'Clé de connexion',
    "Copie cette clé dans l'application (menu « Données ») :\n\n" + cle_() +
    "\n\nNe la partage pas : elle donne accès aux chiffres de ce fichier.",
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/** Appelé par l'application : renvoie les feuilles telles qu'elles s'affichent. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!p.cle || p.cle !== cle_()) return json_({ ok: false, version: VERSION, erreur: 'Clé de connexion invalide.' });
  var ss = SpreadsheetApp.getActive();
  var feuilles = {};
  FEUILLES.forEach(function (nom) {
    var f = ss.getSheetByName(nom);
    if (f) feuilles[nom] = f.getDataRange().getDisplayValues();
  });
  if (!feuilles['Donnée']) return json_({ ok: false, version: VERSION, erreur: 'Feuille « Donnée » introuvable dans le fichier.' });
  return json_({ ok: true, version: VERSION, fichier: ss.getName(), lu: new Date().toISOString(), feuilles: feuilles });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function cle_() {
  var props = PropertiesService.getScriptProperties();
  var k = props.getProperty('CLE');
  if (!k) { k = Utilities.getUuid().replace(/-/g, ''); props.setProperty('CLE', k); }
  return k;
}
