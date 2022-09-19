CREATE DATABASE wesrides1;

CREATE TABLE users(
  user_id uuid DEFAULT uuid_generate_v4(),
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255) NOT NULL UNIQUE,
  confirmed BOOLEAN DEFAULT 'f',
  user_password VARCHAR(255) NOT NULL,
  user_phone_number VARCHAR(10) UNIQUE,
  user_facebook VARCHAR(255),
  user_instagram VARCHAR(255),
  user_snapchat VARCHAR(255),
  PRIMARY KEY(user_id)
);

CREATE TYPE RIDE_STATUS AS ENUM ('pending', 'awaiting_confirmation', 'confirmed', 'completed', 'failed');

CREATE TABLE rides(
  ride_id SERIAL,
  user_id UUID,
  status RIDE_STATUS DEFAULT 'pending',
  location VARCHAR(255) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  has_car BOOLEAN NOT NULL,
  wants_car BOOLEAN NOT NULL,
  wants_uber BOOLEAN NOT NULL,
  additional_comments TEXT,
  PRIMARY KEY (ride_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TYPE RIDE_INTEREST_STATUS AS ENUM ('awaiting_confirmation', 'accepted', 'rejected');

CREATE TABLE ride_interests(
  ride_interest_id SERIAL,
  ride_id SERIAL,
  user_id UUID,
  status RIDE_INTEREST_STATUS DEFAULT 'awaiting_confirmation',
  PRIMARY KEY (ride_interest_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (ride_id) REFERENCES rides(ride_id)
);
