export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lsoa } = req.query;
  if (!lsoa) return res.status(400).json({ error: 'Missing LSOA code' });

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };

    // ONS Census 2021 API - designed for programmatic access
    // TS067 qualifications, TS062 occupations, TS007A age
    const [qualRes, occRes, ageRes] = await Promise.all([
      fetch(`https://api.census.gov.uk/v1/datasets/TS067/editions/2021/versions/1/observations?area-type=lsoa&areas=${lsoa}&dimensions=hiqual`, { headers }),
      fetch(`https://api.census.gov.uk/v1/datasets/TS062/editions/2021/versions/1/observations?area-type=lsoa&areas=${lsoa}&dimensions=nssec`, { headers }),
      fetch(`https://api.census.gov.uk/v1/datasets/TS007A/editions/2021/versions/1/observations?area-type=lsoa&areas=${lsoa}&dimensions=age`, { headers }),
    ]);

    res.status(200).json({
      qualStatus: qualRes.status,
      occStatus:  occRes.status,
      ageStatus:  ageRes.status,
      qualSample: (await qualRes.text()).slice(0, 400),
      occSample:  (await occRes.text()).slice(0, 400),
      ageSample:  (await ageRes.text()).slice(0, 400),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
