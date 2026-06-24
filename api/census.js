export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lsoa } = req.query;
  if (!lsoa) return res.status(400).json({ error: 'Missing LSOA code' });

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };

    // Try fetching one row of data with no filters to see what comes back
    const res1 = await fetch(
      `https://www.nomisweb.co.uk/api/v01/dataset/NM_2083_1.data.json?geography=${lsoa}&measures=20100&RecordLimit=10`,
      { headers }
    );
    const json1 = await res1.json();

    // Also try the codelist for qualifications
    const res2 = await fetch(
      `https://www.nomisweb.co.uk/api/v01/dataset/NM_2083_1/C2021HIQUAL8.def.sdmx.json`,
      { headers }
    );
    const json2 = await res2.json();

    res.status(200).json({
      sample: JSON.stringify(json1).slice(0, 800),
      codelist: JSON.stringify(json2).slice(0, 800),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
