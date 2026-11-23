// We have decided to heavily document only the validation for the first form. 
// Anything unique after that will be handled in its own seperate comment. 
// Therefore once it is covered, then it will most likely not touched upon again.
//*-- Registration Page: ---*/
const registerForm = document.querySelector("#register-form");
const usernameInput = document.querySelector("#username");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const confirmPasswordInput = document.querySelector("#confirm-password");
const registerMessage = document.querySelector("#register-message");

//T: For the collapsable register form:
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
  
  // T: Press submit button and then start checking for errors:
  registerForm.addEventListener("submit", function (event) {
    // T: https://www.w3schools.com/jsref/event_preventdefault.asp
    event.preventDefault();
    
    // T: The "checked" property sets or returns the checked state of a radio button.
    const role = document.querySelector('input[name="userType"]:checked');
    
    // T: All trims in the future are used to remove whitespace, similar to strip() in Python.
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // T: We are using an errors array implementation; makes it simpler and easily pastable to add JS validation for all forms.
    const errors = [];
    
    // T: So if its not checked, then error is to choose one.
    if (!role) {
      errors.push("Choose Pet Owner or Care Provider.");
    }
    if (role && role.value === "carer" && providerServiceInput.value === "") {
      errors.push("Choose the service you provide.");
    }
    if (username.length < 3) {
      errors.push("Username must be at least 3 characters.");
    }
    
    // T: Validity is built-in validation for emails.
    if (email === "" || !emailInput.validity.valid) {
      errors.push("Enter a valid email address.");
    }
    if (password.length < 8) {
      errors.push("Password must be at least 8 characters.");
    }
    if (password !== confirmPassword) {
      errors.push("Passwords do not match.");
    }
    // T: We push error strings to the errors array, now we make the error message by adding all of the errors value.
    // T: Keep them on new line as well.
    if (errors.length > 0) {
      registerMessage.textContent = errors.join("\n");
      return;
    }

    // T: Message here is only for front end part, we will remove it later.
    // T: It is to show that we are validating every field and it gives an approval.
    registerMessage.textContent = "All fields passed front-end validation.";
  });
}
/*-- Login Page: ---*/
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
/*-- Create-request Page: ---*/
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

      // T: Set deadline must always be after the current time.
      if (deadline <= new Date()) {
        errors.push("The bidding deadline must be in the future.");
      }
      // T: Deadline must be before start time.
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
/*-- Pet Profile Page: ---*/
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

    // T: Existence, positive, and integer check.
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
/*-- Request-details Page (Bid form): ---*/
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

    // T: Existence, finite (not NaN or infity) number, and positive.
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
/*-- Browse-Requests Page ---*/
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
/*-- Log-Out Buttons: ---*/
const logoutButtons = document.querySelectorAll("#logout-btn");
for (let i = 0; i < logoutButtons.length; i++) {
  logoutButtons[i].addEventListener("click", function () {
    window.location.href = "logged-out.html";
  });
}
/*----------- X -----------*/