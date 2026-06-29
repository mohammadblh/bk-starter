const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Cache of registered models
const modelsMap = {};

// Load all models in the models folder to ensure they are registered and available
const loadModels = () => {
  const modelsDir = path.join(__dirname, '../models');
  if (fs.existsSync(modelsDir)) {
    const files = fs.readdirSync(modelsDir);
    for (const file of files) {
      if (file.endsWith('.model.js') || file.endsWith('.models.js')) {
        try {
          const modelPath = path.join(modelsDir, file);
          const model = require(modelPath);
          const modelName = model.modelName || model.name;
          if (modelName) {
            modelsMap[file.toLowerCase().replace(/\.model(s)?\.js$/, '')] = model;
          }
        } catch (e) {
          console.error(`Error loading model ${file}:`, e);
        }
      }
    }
  }
};

// Parse server.js to extract route prefixes and variable names
const parseServerRoutes = () => {
  const serverPath = path.join(__dirname, '../server.js');
  if (!fs.existsSync(serverPath)) return {};
  
  const content = fs.readFileSync(serverPath, 'utf8');
  const routePrefixes = {}; // Maps route file name key to api prefix
  
  // Find require statements like: const authRoutes = require('./routes/auth.routes');
  // Or: const userRoutes = require('./routes/user.routes');
  const requireRegex = /const\s+(\w+)\s*=\s*require\(\s*['"]\.\/routes\/([^'"]+)['"]\)/g;
  let match;
  const variableToFileMap = {};
  
  while ((match = requireRegex.exec(content)) !== null) {
    const varName = match[1];
    const fileName = match[2]; // e.g. "user.routes" or "auth.routes" or "uploader.routes"
    variableToFileMap[varName] = fileName;
  }
  
  // Find app.use statements like: app.use('/api/users', userRoutes);
  const useRegex = /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\)/g;
  while ((match = useRegex.exec(content)) !== null) {
    const prefix = match[1];
    const varName = match[2];
    const fileName = variableToFileMap[varName];
    if (fileName) {
      routePrefixes[fileName] = prefix;
    }
  }

  // Fallback default prefixes if not explicitly defined or commented out
  if (!routePrefixes['user.routes'] && !routePrefixes['user.route']) {
    routePrefixes['user.routes'] = '/api/users';
    routePrefixes['user.route'] = '/api/users';
  }
  if (!routePrefixes['uploader.routes'] && !routePrefixes['uploader.route']) {
    routePrefixes['uploader.routes'] = '/api/uploader';
    routePrefixes['uploader.route'] = '/api/uploader';
  }
  if (!routePrefixes['auth.routes'] && !routePrefixes['auth.route']) {
    routePrefixes['auth.routes'] = '/api/auth';
    routePrefixes['auth.route'] = '/api/auth';
  }

  return routePrefixes;
};

// Main parser function
const parseAdminRoutes = () => {
  loadModels();
  const routePrefixes = parseServerRoutes();
  const routesDir = path.join(__dirname, '../routes');
  const adminSections = [];
  
  if (!fs.existsSync(routesDir)) return [];
  
  const files = fs.readdirSync(routesDir);
  
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    
    const filePath = path.join(routesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Extract first comment for Section Name
    let sectionName = '';
    const firstCommentMatch = content.match(/\/\*([\s\S]*?)\*\//) || content.match(/\/\/([^\n]+)/);
    if (firstCommentMatch) {
      sectionName = firstCommentMatch[1].trim();
      // Remove comment asterisks/slashes if any
      sectionName = sectionName.replace(/[\/\*]/g, '').trim();
    }
    
    // If the section name is too generic, skip or use fallback
    if (!sectionName || sectionName.includes('const') || sectionName.includes('require')) {
      sectionName = file.replace(/\.route(s)?\.js$/, '');
      sectionName = sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
    }
    
    // Scan for route definitions and comments preceding them
    const actions = {};
    const routeRegex = /router\.(get|post|put|delete|patch|options|head)\(\s*['"`]([^'"`]+)['"`]/g;
    
    // We will parse route lines and find comments above them
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = /router\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/.exec(line);
      
      if (match) {
        const method = match[1];
        const subPath = match[2];
        
        // Find preceding comments (up to 6 lines above)
        let actionType = '';
        let customFields = null;
        let isExcluded = false;
        
        for (let j = Math.max(0, i - 6); j < i; j++) {
          const prevLine = lines[j].trim();
          
          if (prevLine.includes('action: exclude') || prevLine.includes('// exclude') || prevLine.includes('// ignore')) {
            isExcluded = true;
          }
          
          const actionMatch = /action:\s*([\w-]+)/.exec(prevLine);
          if (actionMatch) {
            actionType = actionMatch[1].trim();
          } else {
            // Check if there is a single word action comment
            const singleActionMatch = /\/\/\s*(create|update|delete|list|read|toggle-status)\s*$/.exec(prevLine);
            if (singleActionMatch && !actionType) {
              actionType = singleActionMatch[1].trim();
            }
          }
          
          const fieldsMatch = /fields:\s*([^\n]+)/.exec(prevLine);
          if (fieldsMatch) {
            customFields = fieldsMatch[1].split(',').map(f => f.trim());
          }
        }
        
        if (isExcluded) continue;
        
        // If we found an action, store it
        if (actionType) {
          actions[actionType] = {
            method,
            path: subPath,
            customFields
          };
        }
      }
    }
    
    // If no actions were parsed, skip this file in admin panel
    if (Object.keys(actions).length === 0) continue;
    
    // Find the associated model
    const fileKey = file.replace(/\.route(s)?\.js$/, '').toLowerCase();
    const model = modelsMap[fileKey] || modelsMap[fileKey.replace(/s$/, '')]; // try singular/plural
    
    let fields = [];
    if (model && model.schema) {
      const schema = model.schema;
      for (const fieldPath in schema.paths) {
        // Skip internal or safe-excluded fields
        if (['_id', '__v', 'createdAt', 'updatedAt', 'password'].includes(fieldPath)) continue;
        
        const pathObj = schema.paths[fieldPath];
        fields.push({
          name: fieldPath,
          type: pathObj.instance,
          required: !!pathObj.isRequired,
          enumValues: pathObj.enumValues || []
        });
      }
    }
    
    // Map filename to its base for matching key
    const fileNameKey = file.replace(/\.js$/, '');
    const prefix = routePrefixes[fileNameKey] || `/api/${fileKey}`;
    
    adminSections.push({
      section: sectionName,
      routeFile: file,
      prefix,
      actions,
      fields
    });
  }
  
  return adminSections;
};

module.exports = {
  parseAdminRoutes
};
