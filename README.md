# Pet_Care_Bidding_Platform

Assalamu Alaikum!

The user starts at the main landing page (index.html). From there, they can choose to either be a pet owner or a care provider, with the either button redirecting them to register.html. As per one of our additional features, a radio button will be selected, and the form itself being collapsable, depending on what the user chose. There are provider-specific fields for the registration when selecting the care provider radio.

After registering, they will be redirected to the login page (login.html) to have their session validated. Once they have successfully logged in, the user will be allowed to access all the pages that require authentication, which we will go through now.

If they logged in as a pet owner, they will be redirected to owner-dashboard.html, where they can access their pets (pets.html), create a request (create-request.html), view their active and past requests (owner-requests.html), and make a review (reviews.html).

If they logged in as a care provider, they will be redirected to provider-dashboard.html, where they can view ongoing requests (create-request.html), view their active and past bids (owner-requests.html), and view their reviews (reviews.html). Another additional feature is the keyword-search using tags on the request cards in browse-request.html, where each tag should show a card that has a different muted-text that identitifes test:shapes or test:months or etc. These tags can help providers find requests by location or certain more niche thing, as we cannot add an infinite amount of entry fields. When they have found a request they might be interested in, they can check the detailed version of that request and make a bid (request-details.html). 

Finally, at all pages after the initial authentication you will be able to log out, which will de-authenticate you and redirect you to the logout page (logged-out.html).