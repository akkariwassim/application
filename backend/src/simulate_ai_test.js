const mongoose = require('mongoose');
const positionsController = require('./controllers/positionsController');
const connectDB = require('./config/mongoose');
const Animal = require('./models/Animal');

async function testAI() {
  try {
    await connectDB();
    
    const targetAnimalId = '69d7c5859777ad218323dd9c';
    const targetUserId = '69d7c147ceaf48e58dd646d6';
    
    console.log(`Searching for animal ${targetAnimalId} for user ${targetUserId}...`);
    
    const animal = await Animal.findById(targetAnimalId);
    if (!animal) {
      console.error('❌ Error: Animal ID not found in database.');
      const allAnimals = await Animal.find({}, '_id name');
      console.log('Available IDs:', JSON.stringify(allAnimals, null, 2));
      process.exit(1);
    }
    
    console.log(`✅ Animal found: ${animal.name}`);
    
    // Mock req, res, next
    const req = {
      user: { id: targetUserId },
      body: {
        animalId: targetAnimalId,
        latitude: '35.038',
        longitude: '9.484',
        temperature: '42.5', 
        activity: '5',       
        battery_level: 80
      }
    };

    const res = {
      status: (code) => ({ 
        json: (data) => console.log(`Response Code ${code}:`, data) 
      }),
      json: (data) => console.log('Response JSON:', data)
    };

    const next = (err) => { 
      if (err) console.error('Controller next() error:', err); 
    };

    console.log('--- Triggering AI Simulation ---');
    await positionsController.submitPosition(req, res, next);
    
    console.log('\nAI Processing started (Async)... Checking logs of smart_fence_ai for activity.');
    setTimeout(() => {
      console.log('Simulation script finished.');
      process.exit(0);
    }, 4000);

  } catch (err) {
    console.error('Fatal Error:', err);
    process.exit(1);
  }
}

testAI();
