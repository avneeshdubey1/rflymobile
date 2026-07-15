const fs = require('fs');
const path = require('path');

exports.login = (req, res) => {
    const { employeeId, password } = req.body;
    
    // Read from file dynamically to avoid require() cache stale data
    const usersPath = path.join(__dirname, '../data/users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    // Find user in our mock JSON database
    const user = users.find(u => u.id === employeeId && u.password === password);

    if (user) {
        // Create a simple base64 encoded mock token for the PoC
        const token = Buffer.from(JSON.stringify({ id: user.id, role: user.role })).toString('base64');
        
        res.status(200).json({
            success: true,
            token,
            user: { 
                id: user.id, 
                email: user.email, 
                role: user.role, 
                name: user.name 
            }
        });
    } else {
        res.status(401).json({ 
            success: false, 
            message: "Invalid email or password" 
        });
    }
};
