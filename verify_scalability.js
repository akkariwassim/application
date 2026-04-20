async function testScalability() {
  const API_URL = 'http://localhost:3000/api';
  
  try {
    console.log('--- Scalability Verification (using native fetch) ---');

    // 1. Login
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wassim@example.com', password: 'password123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    
    if (!token) throw new Error('Login failed: ' + JSON.stringify(loginData));
    console.log('✅ Logged in');

    // 2. Test Bulk Import
    console.log('Testing Bulk Import...');
    const bulkRes = await fetch(`${API_URL}/animals/bulk`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        animals: [
          { name: 'ScalableCow1', type: 'bovine' },
          { name: 'ScalableCow2', type: 'bovine' }
        ]
      })
    });
    const bulkData = await bulkRes.json();
    console.log('Bulk Import Result:', bulkData);

    // 3. Test Pagination
    console.log('Testing Pagination...');
    const paginatedRes = await fetch(`${API_URL}/animals?page=1&limit=1&search=Scalable`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const paginatedData = await paginatedRes.json();
    console.log('Pagination Result:', {
      count: paginatedData.animals?.length,
      total: paginatedData.pagination?.total,
      hasMore: paginatedData.pagination?.hasMore
    });

    console.log('✅ Verification Complete');
  } catch (err) {
    console.error('❌ Verification Failed:', err.message);
  }
}

testScalability();
