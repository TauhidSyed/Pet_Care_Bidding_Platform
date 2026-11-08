// NOTE we have decided to heavily comment the first form validation. and then everything that is unique
// will be handled in its own seperate comment. AKA. once it is covered, then most likely it wont be touched upon again
//*-- Registration page: ---*/
const registerForm = document.querySelector("#register-form");
const usernameInput = document.querySelector("#username");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const confirmPasswordInput = document.querySelector("#confirm-password");
const registerMessage = document.querySelector("#register-message");

//T: for the collapsabe register form
const providerFields = document.querySelector("#provider-fields");
const providerServiceInput = document.querySelector("#provider-service");

function updateProviderFields() {
  const selectedRole = document.querySelector('input[name="userType"]:checked');
  const providerSelected = selectedRole && selectedRole.value === "carer";

  providerFields.hidden = !providerSelected;
  providerServiceInput.required = providerSelected;
}

if (registerForm) {
  const requestedRole = new URLSearchParams(window.location.search).get("role");

  if (requestedRole) {
    const requestedRoleInput = registerForm.querySelector(
      'input[name="userType"][value="' + requestedRole + '"]',
    );

    if (requestedRoleInput) {
      requestedRoleInput.checked = true;
    }
  }

  updateProviderFields();

  const userTypeInputs = registerForm.querySelectorAll(
    'input[name="userType"]',
  );

  for (let i = 0; i < userTypeInputs.length; i++) {
    userTypeInputs[i].addEventListener("change", updateProviderFields);
  }

  // T: press submit button and then start checking for errors

  registerForm.addEventListener("submit", function (event) {
    // T: https://www.w3schools.com/jsref/event_preventdefault.asp
    event.preventDefault();
    // T: The checked property sets or returns the checked state of a radio button.
    const role = document.querySelector('input[name="userType"]:checked');

    // T: All trims in future used to remove whitespace. similar to strip() in pythin

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // T: We are using an errors array implementation. makes it simpler and easily pastable to add JS validation for all forms
    const errors = [];

    // T: So like if its not checked, then error is to choose one

    if (!role) {
      errors.push("Choose Pet Owner or Care Provider.");
    }

    if (role && role.value === "carer" && providerServiceInput.value === "") {
      errors.push("Choose the service you provide.");
    }

    if (username.length < 3) {
      errors.push("Username must be at least 3 characters.");
    }
    // T: validity is built in validation for emails.

    if (email === "" || !emailInput.validity.valid) {
      errors.push("Enter a valid email address.");
    }

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters.");
    }

    if (password !== confirmPassword) {
      errors.push("Passwords do not match.");
    }
    // T: we push error strings to errors array. now we make the error message by adding all the errors value.
    // T: keep them on new line as well.
    if (errors.length > 0) {
      registerMessage.textContent = errors.join("\n");
      return;
    }

    // T: Message here is only for front end part. we will remove it later
    // T: It is to show that we are validating every field and gives an approval
    registerMessage.textContent = "All fields passed front-end validation.";
  });
}
/*----------- X -----------*/

/*-- Login page: ---*/
const loginForm = document.querySelector("#login-form");
const loginUsername = document.querySelector("#username");
const loginPassword = document.querySelector("#password");
const loginMessage = document.querySelector("#login-message");

if (loginForm) {
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const errors = [];
    if (loginUsername.value.trim() === "") {
      errors.push("Enter your username.");
    }

    if (loginPassword.value === "") {
      errors.push("Enter your password.");
    }

    if (errors.length > 0) {
      loginMessage.textContent = errors.join("\n");
    } else {
      loginMessage.textContent = "Both fields are filled in.";
    }
  });
}
/*----------- X -----------*/

/*-- Create request page: ---*/
const requestForm = document.querySelector("#create-request-form");
const petInput = document.querySelector("#pet");
const serviceInput = document.querySelector("#service");
const startTimeInput = document.querySelector("#start-time");
const endTimeInput = document.querySelector("#end-time");
const budgetInput = document.querySelector("#budget");
const deadlineInput = document.querySelector("#deadline");
const requestMessage = document.querySelector("#request-message");

if (requestForm) {
  requestForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const startTime = new Date(startTimeInput.value);
    const endTime = new Date(endTimeInput.value);
    const deadline = new Date(deadlineInput.value);
    const errors = [];

    if (petInput.value === "") {
      errors.push("Choose a pet.");
    }

    if (serviceInput.value === "") {
      errors.push("Choose a service.");
    }

    if (startTimeInput.value === "") {
      errors.push("Enter when the service starts.");
    }

    if (endTimeInput.value === "") {
      errors.push("Enter when the service ends.");
    } else if (startTimeInput.value && startTime >= endTime) {
      errors.push("The end time must be after the start time.");
    }

    if (budgetInput.value === "" || Number(budgetInput.value) <= 0) {
      errors.push("Enter a budget greater than zero.");
    }

    if (deadlineInput.value === "") {
      errors.push("Choose a bidding deadline.");
    } else {
      // T: set deadline must always be after the current time

      if (deadline <= new Date()) {
        errors.push("The bidding deadline must be in the future.");
      }
      // T: deadline must be before start time.
      if (startTimeInput.value && deadline >= startTime) {
        errors.push("The bidding deadline must be before the service starts.");
      }
    }

    if (errors.length > 0) {
      requestMessage.textContent = errors.join("\n");
    } else {
      requestMessage.textContent = "All request fields passed validation.";
    }
  });
}

/*-- Pet profile page: ---*/
const petForm = document.querySelector("#pet-form");
const petNameInput = document.querySelector("#pet-name");
const petTypeInput = document.querySelector("#pet-type");
const petBreedInput = document.querySelector("#pet-breed");
const petAgeInput = document.querySelector("#pet-age");
const petPhotoInput = document.querySelector("#pet-photo");
const petMessage = document.querySelector("#pet-message");

if (petForm) {
  petForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const errors = [];

    if (petNameInput.value.trim().length < 2) {
      errors.push("Enter a pet name with at least 2 characters.");
    }

    if (petTypeInput.value === "") {
      errors.push("Choose a type of pet.");
    }

    if (petBreedInput.value.trim() === "") {
      errors.push("Enter the pet's breed.");
    }
    // T: existence check, positive and integer check
    if (
      petAgeInput.value === "" ||
      Number(petAgeInput.value) < 0 ||
      !Number.isInteger(Number(petAgeInput.value))
    ) {
      errors.push("Enter the pet's age as a whole number of 0 or more.");
    }

    if (petPhotoInput.value.trim() === "" || !petPhotoInput.validity.valid) {
      errors.push("Enter a valid photo URL.");
    }

    if (errors.length > 0) {
      petMessage.textContent = errors.join("\n");
    } else {
      petMessage.textContent = "Pet details passed front-end validation.";
    }
  });
}
/*----------- X -----------*/

/*-- Request details page (Bid form): ---*/
const bidForm = document.querySelector("#bid-form");
const bidPriceInput = document.querySelector("#bid-price");
const bidDescriptionInput = document.querySelector("#bid-description");
const bidMessage = document.querySelector("#bid-message");

if (bidForm) {
  bidForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const bidPrice = Number(bidPriceInput.value);
    const bidDescription = bidDescriptionInput.value.trim();
    const errors = [];
    // T: existence, finite (not NaN or infity) number and positive
    if (
      bidPriceInput.value === "" ||
      !Number.isFinite(bidPrice) ||
      bidPrice <= 0
    ) {
      errors.push("Enter a bid price greater than zero.");
    }

    if (bidDescription.length < 10) {
      errors.push("Describe your service in at least 10 characters.");
    }

    if (errors.length > 0) {
      bidMessage.textContent = errors.join("\n");
    } else {
      bidMessage.textContent = "Bid details passed front-end validation.";
    }
  });
}
/*----------- X -----------*/

/*-- Request details page (CARDS sample data) ---*/
const requestDetailsCard = document.querySelector("#request-details-card");
const requestLoadMessage = document.querySelector("#request-load-message");
const requestPetText = document.querySelector("#request-pet");
const requestServiceText = document.querySelector("#request-service");
const requestStartText = document.querySelector("#request-start");
const requestEndText = document.querySelector("#request-end");
const requestBudgetText = document.querySelector("#request-budget");
const requestDeadlineText = document.querySelector("#request-deadline");
const requestInstructionsText = document.querySelector("#request-instructions");

// T : hard coded sample request so we can see how req details looks liek
const sampleRequest = {
  pet: "Cloud - Cat",
  service: "Pe walking",
  start: "2026-11-12T09:00:00",
  end: "2026-11-12T10:00:00",
  budget: 120,
  deadline: "2026-11-10T18:00:00",
  instructions:
    "Cloud is very allergic to earth fire water and air. Please utmost care or we will take legal action!!",
};

// T : change the text content of the p for each of them
if (requestDetailsCard) {
  requestPetText.textContent = sampleRequest.pet;
  requestServiceText.textContent = sampleRequest.service;
  // T : turns date text thing into an object that JS can work with
  // T: toLocaleString() method returns a Date object as a string, using locale settings.
  requestStartText.textContent = new Date(sampleRequest.start).toLocaleString();
  requestEndText.textContent = new Date(sampleRequest.end).toLocaleString();
  requestBudgetText.textContent = "AED " + sampleRequest.budget;
  requestDeadlineText.textContent = new Date(
    sampleRequest.deadline,
  ).toLocaleString();
  requestInstructionsText.textContent = sampleRequest.instructions;
}
/*----------- X -----------*/

/*-- broswer req page ---*/
const browseRequestCards = document.querySelectorAll(".browse-request-card");
const requestSearchInput = document.querySelector("#request-search");
const petTypeFilter = document.querySelector("#pet-type-filter");
const serviceFilter = document.querySelector("#service-filter");
const budgetFilter = document.querySelector("#budget-filter");
const clearFiltersButton = document.querySelector("#clear-filters");
const requestCountMessage = document.querySelector("#request-count");
const noRequestsMessage = document.querySelector("#no-requests-message");

function filterRequests() {
  const searchText = requestSearchInput.value.trim().toLowerCase();
  const selectedPetType = petTypeFilter.value;
  const selectedService = serviceFilter.value;

  let maxBudget = Infinity;

  if (budgetFilter.value !== "") {
    maxBudget = Number(budgetFilter.value);
  }

  let visibleRequests = 0;

  for (let i = 0; i < browseRequestCards.length; i++) {
    const card = browseRequestCards[i];
    const searchableText = (
      card.textContent +
      " " +
      card.dataset.search +
      " " +
      card.dataset.instructions
    ).toLowerCase();

    const matchesSearch = searchableText.includes(searchText);
    const matchesPetType =
      selectedPetType === "" || card.dataset.petType === selectedPetType;
    const matchesService =
      selectedService === "" || card.dataset.service === selectedService;
    const matchesBudget = Number(card.dataset.budget) <= maxBudget;

    if (matchesSearch && matchesPetType && matchesService && matchesBudget) {
      card.hidden = false;
      visibleRequests++;
    } else {
      card.hidden = true;
    }
  }

  requestCountMessage.textContent = visibleRequests + " requests found";
  noRequestsMessage.hidden = visibleRequests > 0;
}

if (browseRequestCards.length > 0) {
  filterRequests();

  requestSearchInput.addEventListener("input", function () {
    filterRequests();
  });

  petTypeFilter.addEventListener("change", function () {
    filterRequests();
  });

  serviceFilter.addEventListener("change", function () {
    filterRequests();
  });

  budgetFilter.addEventListener("input", function () {
    filterRequests();
  });

  clearFiltersButton.addEventListener("click", function () {
    requestSearchInput.value = "";
    petTypeFilter.value = "";
    serviceFilter.value = "";
    budgetFilter.value = "";

    filterRequests();
  });
}
/*----------- X -----------*/

/*-- Log out buttons: ---*/
const logoutButtons = document.querySelectorAll("#logout-btn");

for (let i = 0; i < logoutButtons.length; i++) {
  logoutButtons[i].addEventListener("click", function () {
    window.location.href = "logged-out.html";
  });
}
/*----------- X -----------*/
