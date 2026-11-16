import type { Grilles } from './feuilleDonnee'

/**
 * Copie de la feuille « Donnée » au 15/11/2026, utilisée tant que la connexion au Google Sheet
 * n'est pas active. Dès que le Sheet est connecté, ce sont ses chiffres en direct qui s'affichent.
 */
export const DATE_COPIE = '15/11/2026'

const CI = "Côte d'Ivoire"

export const GRILLES_COPIE: Grilles = {
  Donnée: [
    ['KPI', CI, CI, 'RDC', 'RDC', 'Togo', 'Togo', 'Benin', 'Benin'],
    ['Sous Type', 'Couverture', 'Stock', 'Couverture', 'Stock', 'Couverture', 'Stock', 'Couverture', 'Stock'],
    ['OTD S1 26/10/2026', '91,0%', '', '66,7%', '', '', '', '', ''],
    ['OTD S2 02/11/2026', '98,8%', '', '85,7%', '', '', '', '', ''],
    ['OTD S3 09/11/2026', '67%', '', '56%', '', '', '', '', ''],
    ['Recap OTD', '7,8%', '', '19,0%', '', '', '', '', ''],
    ['Montures', '159', '', '146', '', '', '', '', ''],
    ['Lapaire +', '17 / 25', '', '20/ 25', '', '', '', '', ''],
    ['Solaires', '22 solaires', '', '16 solaires', '', '', '', '', ''],
    ['Etuis', '6,6', '35383', '1,6', '255', '', '', '', ''],
    ['Etuis+', '15,5', '3579', '19,3', '135', '', '', '', ''],
    ['Sacs cabas', '1,3', '6750', '2,16', '350', '', '', '', ''],
    ['Sprays', '4,40', '554', '', '5', '', '', '', ''],
    ['Pochette', '1,95', '1365', '7,17', '86', '', '', '', ''],
    ['Affaire non assemblée', '9', '', '2', '', '', '', '', ''],
    ['Productivité', '100,00%', '', '100,00%', '', '', '', '', ''],
    ['Casse atelier', '1,6', '', '0,6', '', '', '', '', ''],
    ['Qualité de montage', '1,3', '', '1,9', '', '', '', '', ''],
    ['Respect des tournées', '70', '', '', '', '', '', '', ''],
    ['Conduite & entretien moto', '100', '', '', '', '', '', '', ''],
    ['Communication', '100', '', '', '', '', '', '', ''],
  ],
  'KPI OTD': [
    ['Pays', 'Semaine du 26/10/2026', 'Semaine du 02/11/2026', 'Semaine du 09/11/2026', 'WoW'],
    [CI, '91,0%', '98,8%', '', '7,8%'],
    ['RDC', '66,7%', '85,7%', '', '19,0%'],
    ['Togo', '', '', '', '0%'],
    ['Benin', '', '', '', '0%'],
  ],
  'Point mensuel': [
    ['Pays', 'septembre 2026', 'octobre 2026', 'WOW'],
    [CI, '80,1%', '78,4%', '-1,7%'],
    ['', '', '', ''],
  ],
}
