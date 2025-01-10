# Folkatech Node.js User Management Project

A Node.js-based user management system with authentication and user management functionalities. This project leverages MongoDB for database management, Redis for caching, and JWT for authentication.

## Features

- **Authentication:**
  - Register new users
  - Login to obtain access tokens

- **User Management:**
  - Retrieve a list of users
  - Create a new user
  - Retrieve user details by account number or identity number
  - Update user details
  - Delete users

## API Endpoints

### Authentication

#### Register a New User
**POST** `/auth/register`

#### Login to Get Access Token
**POST** `/auth/login`

### Users

#### Get List of Users
**GET** `/users`

#### Create a New User
**POST** `/users`

#### Get User by Account Number
**GET** `/users/account/{accountNumber}`

#### Get User by Identity Number
**GET** `/users/identity/{identityNumber}`

#### Update User Details
**PUT** `/users/{id}`

#### Delete User
**DELETE** `/users/{id}`

## Environment Variables

Create a `.env` file in the root of the project and include the following variables:

```
MONGODB_URI=mongodb://localhost:27017/folkatech_db
JWT_SECRET=your_jwt_secret_key
REDIS_URL=redis://localhost:6379
```

## Running the Server

The server runs on port `3000`. You can start the server with:

```bash
npm install
npm start
```

## API Documentation

API documentation is available at:

```
{{base_url}}/api-docs
```

## Deployment

The project is deployed at:

[https://folkatech-nodejs-3f733ec61033.herokuapp.com/api-docs](https://folkatech-nodejs-3f733ec61033.herokuapp.com/api-docs)

## Technologies Used

- **Node.js**
- **Express.js**
- **MongoDB**
- **Redis**
- **JWT**

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/YourFeature`)
3. Commit your changes (`git commit -m 'Add YourFeature'`)
4. Push to the branch (`git push origin feature/YourFeature`)
5. Open a pull request

## License

This project is licensed under the MIT License.
