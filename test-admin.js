const fs = require('fs');
const content = fs.readFileSync('.env.local', 'utf-8');
const envConfig = {};
content.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envConfig[match[1]] = match[2].replace(/(^"|"$)/g, '');
  }
});
const { createClient } = require('@supabase/supabase-js');
const adminAuthClient = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);
adminAuthClient.from('profiles').select('*').limit(1).then(res => console.log(res.data));
