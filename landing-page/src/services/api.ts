const API_BASE = '';
const INGEST_TOKEN = '849d5c028ce7bd3ecf54690e1a0457bd5f6abfbb762accff8ee730f5de3166f6';

export interface Statistics {
  totalCases: number;
  diagnosedCases: number;
  pullRequestsCreated: number;
  diagnosisSuccessRate: number;
}

export async function fetchStatistics(): Promise<Statistics> {
  const res = await fetch(`${API_BASE}/api/v1/public/statistics`, {
    headers: {
      Authorization: `Ingest ${INGEST_TOKEN}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Statistics API failed: ${res.status}`);
  }

  return res.json();
}
