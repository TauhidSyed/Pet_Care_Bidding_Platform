USE pet_care_bidding;

START TRANSACTION;

INSERT INTO users (username, email, password_hash, role)
VALUES ('db_test_owner', 'db_test_owner@example.invalid', 'NOT_A_REAL_PASSWORD_HASH', 'owner');
SET @test_owner_id = LAST_INSERT_ID();

INSERT INTO users (username, email, password_hash, role, provider_service, provider_experience)
VALUES ('db_test_carer', 'db_test_carer@example.invalid', 'NOT_A_REAL_PASSWORD_HASH', 'carer', 'walking', 'Experienced with dogs');
SET @test_carer_id = LAST_INSERT_ID();

INSERT INTO pets (owner_id, name, pet_type, breed, age_years, photo_url)
VALUES (@test_owner_id, 'Rocky', 'dog', 'Labrador', 3, NULL);
SET @test_pet_id = LAST_INSERT_ID();

INSERT INTO care_requests
  (owner_id, pet_id, service, service_start, service_end,
   budget, bidding_deadline, instructions)
VALUES
  (@test_owner_id, @test_pet_id, 'walking',
   DATE_ADD(NOW(), INTERVAL 3 DAY),
   DATE_ADD(NOW(), INTERVAL 3 DAY) + INTERVAL 1 HOUR,
   100.00, DATE_ADD(NOW(), INTERVAL 1 DAY),
   'Please bring water');
SET @test_request_id = LAST_INSERT_ID();

INSERT INTO request_tags (request_id, tag)
VALUES (@test_request_id, 'dog'), (@test_request_id, 'walking');

INSERT INTO bids (request_id, provider_id, proposed_price, description)
VALUES (@test_request_id, @test_carer_id, 85.00, 'I can walk Rocky in the afternoon.');

UPDATE bids SET status = 'accepted'
WHERE request_id = @test_request_id AND provider_id = @test_carer_id;
UPDATE care_requests SET status = 'completed'
WHERE id = @test_request_id;

INSERT INTO reviews (request_id, reviewer_id, reviewee_id, rating, comment)
VALUES (@test_request_id, @test_owner_id, @test_carer_id, 5, 'Great service');

SELECT p.name AS pet_name,
       r.service,
       r.budget,
       r.status AS request_status,
       b.proposed_price,
       b.status AS bid_status,
       v.rating
FROM care_requests AS r
JOIN pets AS p ON p.id = r.pet_id
JOIN bids AS b ON b.request_id = r.id
JOIN reviews AS v ON v.request_id = r.id
WHERE r.id = @test_request_id;

ROLLBACK;