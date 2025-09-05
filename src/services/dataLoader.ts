import { XMLParser } from 'fast-xml-parser';
import { Rapport, GlobalData } from '../models/types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  // It's easier to work with arrays consistently
  isArray: (name, jpath, isLeafNode, isAttribute) => {
    return [
        'RAPPORT.COMMANDANT.SYSTEMES.S',
        'RAPPORT.COMMANDANT.FLOTTES.F',
        'RAPPORT.COMMANDANT.DETECTIONS.FLOTTE',
        'RAPPORT.COMMANDANT.DETECTIONS.SYSTEME',
        'RAPPORT.COMMANDANT.PNA.P',
        'RAPPORT.COMMANDANT.ALLIANCE.COM',
        'DATA.RACES.C',
        'DATA.COMMANDANTS.C'
    ].includes(jpath);
  }
});

export const loadRapportData = async (): Promise<Rapport | null> => {
  try {
    const response = await fetch('/examples/rapport.xml');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const xmlText = await response.text();
    const data = parser.parse(xmlText);
    return data;
  } catch (error) {
    console.error('Error loading or parsing rapport.xml:', error);
    return null;
  }
};

export const loadGlobalData = async (): Promise<GlobalData | null> => {
  try {
    const response = await fetch('/examples/data.xml');
     if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const xmlText = await response.text();
    const data = parser.parse(xmlText);
    return data;
  } catch (error) {
    console.error('Error loading or parsing data.xml:', error);
    return null;
  }
};
