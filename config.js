const requiredVariables = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

function getConfig() {
  const missing = requiredVariables.filter((name) => !process.env[name]);
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');

  if (url && !/^https:\/\//i.test(url)) {
    throw new Error('SUPABASE_URL harus menggunakan HTTPS.');
  }

  return {
    url,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    port: Number(process.env.PORT || 3000),
    missing
  };
}

module.exports = { getConfig };
