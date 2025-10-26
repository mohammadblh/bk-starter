# Dockerfile
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose ports
EXPOSE 3030 3031

# Command to run the application
CMD ["node", "serverReview.js"] 
