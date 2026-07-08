async function run() {
  console.log('Testing customer portal APIs via global fetch...');

  try {
    const resCheckouts = await fetch('http://localhost:3000/api/portal/checkouts');
    const jsonCheckouts = await resCheckouts.json();
    console.log('GET /portal/checkouts response:');
    console.dir(jsonCheckouts, { depth: null });

    const resOrders = await fetch('http://localhost:3000/api/portal/custom-order');
    const jsonOrders = await resOrders.json();
    console.log('GET /portal/custom-order response:');
    console.dir(jsonOrders, { depth: null });

    const resSchemes = await fetch('http://localhost:3000/api/portal/customer-schemes');
    const jsonSchemes = await resSchemes.json();
    console.log('GET /portal/customer-schemes response:');
    console.dir(jsonSchemes, { depth: null });

  } catch (err) {
    console.error('API call failed:', err);
  }
}

run();
