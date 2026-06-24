export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lsoa } = req.query;
  if (!lsoa) return res.status(400).json({ error: 'Missing LSOA code' });

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };

    // Get the full definition to find correct parameter codes
    const defRes = await fetch(
      `https://www.nomisweb.co.uk/api/v01/dataset/NM_2083_1.def.sdmx.json`,
      { headers }
    );
    const defJson = await defRes.json();
    
    // Dig into the codelists to find qualification variable codes
    const keyfamilies = defJson?.structure?.keyfamilies?.keyfamily?.[0];
    const components = keyfamilies?.components?.dimension || [];
    const codelist = defJson?.structure?.codelists?.codelist || [];

    res.status(200).json({
      dimensions: components.map(c => ({ id: c['@conceptref'], codelist: c.codelistref })),
      codelists: codelist.map(cl => ({
        id: cl['@id'],
        codes: (cl.code || []).slice(0, 10).map(c => ({ value: c['@value'], desc: c.description?.['#text'] }))
      }))
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
