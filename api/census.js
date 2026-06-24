export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lsoa } = req.query;
  if (!lsoa) return res.status(400).json({ error: 'Missing LSOA code' });

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };

    const searchRes = await fetch(
      `https://www.nomisweb.co.uk/api/v01/dataset/def.sdmx.json?search=*TS067*`,
      { headers }
    );
    const searchJson = await searchRes.json();

    // Extract just the dataset IDs and names
    const families = searchJson?.structure?.keyfamilies?.keyfamily || [];
    const datasets = families.map(f => ({
      id: f['@id'],
      name: f['@name'] || f.name,
      annotations: (f.annotations?.annotation || []).map(a => `${a.annotationtitle}: ${a.annotationtext}`).join(' | ')
    }));

    res.status(200).json({ datasets });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
