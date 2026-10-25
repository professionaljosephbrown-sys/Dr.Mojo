// All 50 states + DC with their position on the tile-grid map.
// The last two numbers are rough home value / income figures ($k) used only
// by the demo data generator (sample-data.js) when no real snapshot exists.
// [code, name, gridCol, gridRow, medianHomeValue ($k), medianIncome ($k)]
export const STATES = [
  ['AK', 'Alaska', 0, 0, 365, 89], ['ME', 'Maine', 11, 0, 395, 71],
  ['VT', 'Vermont', 10, 1, 385, 74], ['NH', 'New Hampshire', 11, 1, 485, 95],
  ['WA', 'Washington', 1, 2, 585, 94], ['ID', 'Idaho', 2, 2, 460, 74],
  ['MT', 'Montana', 3, 2, 465, 70], ['ND', 'North Dakota', 4, 2, 265, 73],
  ['MN', 'Minnesota', 5, 2, 335, 85], ['IL', 'Illinois', 6, 2, 270, 80],
  ['WI', 'Wisconsin', 7, 2, 305, 72], ['MI', 'Michigan', 8, 2, 245, 69],
  ['NY', 'New York', 9, 2, 475, 82], ['RI', 'Rhode Island', 10, 2, 465, 82],
  ['MA', 'Massachusetts', 11, 2, 625, 99],
  ['OR', 'Oregon', 1, 3, 505, 80], ['NV', 'Nevada', 2, 3, 440, 75],
  ['WY', 'Wyoming', 3, 3, 345, 73], ['SD', 'South Dakota', 4, 3, 305, 71],
  ['IA', 'Iowa', 5, 3, 225, 71], ['IN', 'Indiana', 6, 3, 245, 68],
  ['OH', 'Ohio', 7, 3, 235, 68], ['PA', 'Pennsylvania', 8, 3, 275, 74],
  ['NJ', 'New Jersey', 9, 3, 545, 99], ['CT', 'Connecticut', 10, 3, 425, 91],
  ['CA', 'California', 1, 4, 790, 95], ['UT', 'Utah', 2, 4, 535, 91],
  ['CO', 'Colorado', 3, 4, 560, 92], ['NE', 'Nebraska', 4, 4, 265, 74],
  ['MO', 'Missouri', 5, 4, 250, 68], ['KY', 'Kentucky', 6, 4, 215, 62],
  ['WV', 'West Virginia', 7, 4, 165, 56], ['VA', 'Virginia', 8, 4, 405, 90],
  ['MD', 'Maryland', 9, 4, 425, 98], ['DE', 'Delaware', 10, 4, 385, 82],
  ['AZ', 'Arizona', 2, 5, 425, 76], ['NM', 'New Mexico', 3, 5, 315, 62],
  ['KS', 'Kansas', 4, 5, 230, 70], ['AR', 'Arkansas', 5, 5, 205, 58],
  ['TN', 'Tennessee', 6, 5, 325, 66], ['NC', 'North Carolina', 7, 5, 335, 70],
  ['SC', 'South Carolina', 8, 5, 305, 67], ['DC', 'District of Columbia', 9, 5, 600, 108],
  ['OK', 'Oklahoma', 4, 6, 205, 61], ['LA', 'Louisiana', 5, 6, 200, 58],
  ['MS', 'Mississippi', 6, 6, 180, 54], ['AL', 'Alabama', 7, 6, 230, 62],
  ['GA', 'Georgia', 8, 6, 325, 72],
  ['HI', 'Hawaii', 0, 7, 850, 95], ['TX', 'Texas', 4, 7, 300, 75],
  ['FL', 'Florida', 9, 7, 385, 71],
];
