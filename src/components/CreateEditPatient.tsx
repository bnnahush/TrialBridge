import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  User, Check, RefreshCw, AlertCircle, ShieldCheck, Mail, Phone, MapPin, Sparkles
} from "lucide-react";
import { fhirClient } from "../fhirClient";
import { useApp } from "../context/AppContext";

interface CreateEditPatientProps {
  patientId?: string;
}

export const CreateEditPatient: React.FC<CreateEditPatientProps> = ({ patientId }) => {
  const navigate = useNavigate();
  const { setIsLoading, setSuccess } = useApp();

  const isEdit = !!patientId;

  // Form Fields State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");

  // UI Flow State Managers
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [originalResource, setOriginalResource] = useState<any>(null);

  // Load existing Patient for edit
  useEffect(() => {
    if (patientId) {
      const fetchPatient = async () => {
        setLoading(true);
        setFormError(null);
        try {
          const p = await fhirClient.getPatient(patientId);
          setOriginalResource(p);

          // Name maps
          const firstNameVal = p.name?.[0]?.given?.[0] || "";
          const lastNameVal = p.name?.[0]?.family || "";
          setFirstName(firstNameVal);
          setLastName(lastNameVal);

          // Gender maps
          setGender(p.gender || "unknown");

          // BirthDate maps
          setBirthDate(p.birthDate || "");

          // Phone at telecom[0], Email at telecom[1]
          let phoneVal = "";
          let emailVal = "";
          if (Array.isArray(p.telecom)) {
            const phoneItem = p.telecom[0]?.system === "phone" ? p.telecom[0] : p.telecom.find((t: any) => t.system === "phone");
            if (phoneItem) phoneVal = phoneItem.value || "";
            
            const emailItem = p.telecom[1]?.system === "email" ? p.telecom[1] : p.telecom.find((t: any) => t.system === "email");
            if (emailItem) emailVal = emailItem.value || "";
          }
          setPhone(phoneVal);
          setEmail(emailVal);

          // Address lines at address[0]
          let line1Val = "";
          let cityVal = "";
          let stateVal = "";
          let postalCodeVal = "";
          let countryVal = "";
          if (Array.isArray(p.address) && p.address.length > 0) {
            const addr = p.address[0];
            line1Val = addr.line?.[0] || "";
            cityVal = addr.city || "";
            stateVal = addr.state || "";
            postalCodeVal = addr.postalCode || "";
            countryVal = addr.country || "";
          }
          setLine1(line1Val);
          setCity(cityVal);
          setState(stateVal);
          setPostalCode(postalCodeVal);
          setCountry(countryVal);

        } catch (err: any) {
          console.error(err);
          setFormError(`Failed to load patient profile details: ${err.message || err}`);
        } finally {
          setLoading(false);
        }
      };
      fetchPatient();
    } else {
      // Clear inputs for fresh creates
      setFirstName("");
      setLastName("");
      setGender("");
      setBirthDate("");
      setPhone("");
      setEmail("");
      setLine1("");
      setCity("");
      setState("");
      setPostalCode("");
      setCountry("");
    }
  }, [patientId]);

  // Form Field Validation Logic
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!firstName.trim()) {
      errors.firstName = "First name is required.";
    }
    if (!lastName.trim()) {
      errors.lastName = "Last name is required.";
    }
    if (!gender) {
      errors.gender = "Gender selection is required.";
    }

    if (!birthDate) {
      errors.birthDate = "Date of birth is required.";
    } else {
      const dobDate = new Date(birthDate);
      const minDate = new Date("1900-01-01");
      const today = new Date();

      if (dobDate < minDate) {
        errors.birthDate = "Date of birth cannot be before Jan 01, 1900.";
      } else if (dobDate >= today) {
        errors.birthDate = "Date of birth must be in the past.";
      }
    }

    if (phone.trim()) {
      const e164Regex = /^\+[1-9]\d{1,14}$/;
      if (!e164Regex.test(phone.trim())) {
        errors.phone = "Phone must match E.164 format (e.g., +12125550123).";
      }
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = "Please enter a valid email address.";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setIsLoading(true);

    try {
      if (isEdit) {
        // Prepare PUT payload
        const telecomArr: any[] = [];
        telecomArr[0] = { system: "phone", value: phone.trim() };
        telecomArr[1] = { system: "email", value: email.trim() };

        const addressArr = (line1.trim() || city.trim() || state.trim() || postalCode.trim() || country.trim()) ? [
          {
            line: line1.trim() ? [line1.trim()] : [],
            city: city.trim(),
            state: state.trim(),
            postalCode: postalCode.trim(),
            country: country.trim()
          }
        ] : undefined;

        const updatedResource = {
          ...originalResource,
          name: [
            {
              use: "official",
              family: lastName.trim(),
              given: [firstName.trim()]
            }
          ],
          gender: gender,
          birthDate: birthDate,
          telecom: telecomArr,
          address: addressArr
        };

        await fhirClient.request(`Patient/${patientId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/fhir+json" },
          body: JSON.stringify(updatedResource)
        });

        setSuccess("Patient updated successfully");
        navigate(`/patients/${patientId}`);
      } else {
        // Prepare POST payload
        const telecomArr: any[] = [];
        if (phone.trim()) {
          telecomArr[0] = { system: "phone", value: phone.trim() };
        }
        if (email.trim()) {
          telecomArr[1] = { system: "email", value: email.trim() };
        }

        const addressArr = (line1.trim() || city.trim() || state.trim() || postalCode.trim() || country.trim()) ? [
          {
            line: line1.trim() ? [line1.trim()] : [],
            city: city.trim(),
            state: state.trim(),
            postalCode: postalCode.trim(),
            country: country.trim()
          }
        ] : undefined;

        const newResource: any = {
          resourceType: "Patient",
          active: true,
          name: [
            {
              use: "official",
              family: lastName.trim(),
              given: [firstName.trim()]
            }
          ],
          gender: gender,
          birthDate: birthDate
        };

        if (telecomArr.length > 0 || phone.trim() || email.trim()) {
          newResource.telecom = telecomArr;
        }

        if (addressArr) {
          newResource.address = addressArr;
        }

        const result = await fhirClient.request("Patient", {
          method: "POST",
          headers: { "Content-Type": "application/fhir+json" },
          body: JSON.stringify(newResource)
        });

        const newId = result.id;
        setSuccess("Patient created successfully");
        navigate(`/patients/${newId}`);
      }
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Failed to commit clinical patient record to FHIR proxy server.");
    } finally {
      setSubmitting(false);
      setIsLoading(false);
    }
  };

  // Skeleton UI for loading state on edit
  if (loading) {
    return (
      <div id="loading-skeleton-form" className="space-y-6 bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs animate-pulse">
        <div className="space-y-3">
          <div className="h-4 bg-slate-100 rounded w-1/4"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-9 bg-slate-100 rounded"></div>
            <div className="h-9 bg-slate-100 rounded"></div>
          </div>
        </div>
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="h-4 bg-slate-100 rounded w-1/4"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-9 bg-slate-100 rounded"></div>
            <div className="h-9 bg-slate-100 rounded"></div>
          </div>
        </div>
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="h-4 bg-slate-100 rounded w-1/4"></div>
          <div className="h-20 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div id="patient-create-edit-form-container">
      {/* 1. OperationOutcome Server Error Alert Banner */}
      {formError && (
        <div id="fhir-outcome-error-banner" className="mb-6 p-4 border border-rose-150 bg-rose-50 rounded-xl text-rose-800 text-xs flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <span className="font-extrabold uppercase tracking-widest block text-[10px]">FHIR OperationOutcome</span>
            <p className="leading-relaxed font-semibold">{formError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs">
        
        {/* SECTION 1: Personal Profile */}
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <User className="w-4 h-4 text-teal-accent" />
            <h2 className="text-xs font-bold text-navy-primary uppercase tracking-wider">
              Official Demographics & Identity
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* First Name */}
            <div className="space-y-1.5">
              <label htmlFor="first_name_input" className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                First / Given Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="first_name_input"
                type="text"
                placeholder="Dr. Sarah"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (validationErrors.firstName) {
                    setValidationErrors(prev => ({ ...prev, firstName: "" }));
                  }
                }}
                className={`w-full bg-slate-50 border focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent rounded-lg py-1.5 px-3 text-xs text-slate-800 transition focus:outline-none ${
                  validationErrors.firstName ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {validationErrors.firstName && (
                <p className="text-[10px] text-rose-600 font-semibold">{validationErrors.firstName}</p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-1.5">
              <label htmlFor="last_name_input" className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                Last / Family Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="last_name_input"
                type="text"
                placeholder="Chen"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (validationErrors.lastName) {
                    setValidationErrors(prev => ({ ...prev, lastName: "" }));
                  }
                }}
                className={`w-full bg-slate-50 border focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent rounded-lg py-1.5 px-3 text-xs text-slate-800 transition focus:outline-none ${
                  validationErrors.lastName ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {validationErrors.lastName && (
                <p className="text-[10px] text-rose-600 font-semibold">{validationErrors.lastName}</p>
              )}
            </div>

            {/* Gender */}
            <div className="space-y-1.5">
              <label htmlFor="gender_select" className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                Gender <span className="text-rose-500">*</span>
              </label>
              <select
                id="gender_select"
                value={gender}
                onChange={(e) => {
                  setGender(e.target.value);
                  if (validationErrors.gender) {
                    setValidationErrors(prev => ({ ...prev, gender: "" }));
                  }
                }}
                className={`w-full bg-slate-50 border focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent rounded-lg py-1.5 px-3 text-xs text-slate-800 transition focus:outline-none ${
                  validationErrors.gender ? "border-rose-500" : "border-slate-200"
                }`}
              >
                <option value="">-- Choose Gender --</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
                <option value="unknown">Unknown</option>
              </select>
              {validationErrors.gender && (
                <p className="text-[10px] text-rose-600 font-semibold">{validationErrors.gender}</p>
              )}
            </div>

            {/* Date of Birth */}
            <div className="space-y-1.5">
              <label htmlFor="birth_date_input" className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                Date of Birth <span className="text-rose-500">*</span>
              </label>
              <input
                id="birth_date_input"
                type="date"
                min="1900-01-01"
                value={birthDate}
                onChange={(e) => {
                  setBirthDate(e.target.value);
                  if (validationErrors.birthDate) {
                    setValidationErrors(prev => ({ ...prev, birthDate: "" }));
                  }
                }}
                className={`w-full bg-slate-50 border focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent rounded-lg py-1.5 px-3 text-xs text-slate-800 transition focus:outline-none ${
                  validationErrors.birthDate ? "border-rose-500" : "border-slate-200"
                }`}
              />
              {validationErrors.birthDate && (
                <p className="text-[10px] text-rose-600 font-semibold">{validationErrors.birthDate}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: Contact Information */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Phone className="w-4 h-4 text-teal-accent" />
            <h2 className="text-xs font-bold text-navy-primary uppercase tracking-wider">
              Contact Channels <span className="text-[10px] text-slate-400 font-normal normal-case ml-1">(Optional)</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Phone */}
            <div className="space-y-1.5">
              <label htmlFor="phone_input" className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                Phone Number
              </label>
              <input
                id="phone_input"
                type="tel"
                placeholder="+12125550123"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (validationErrors.phone) {
                    setValidationErrors(prev => ({ ...prev, phone: "" }));
                  }
                }}
                className={`w-full bg-slate-50 border focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent rounded-lg py-1.5 px-3 text-xs text-slate-800 transition focus:outline-none ${
                  validationErrors.phone ? "border-rose-500" : "border-slate-200"
                }`}
              />
              <p className="text-[10px] text-slate-400 font-medium">Use international E.164 syntax (e.g. +1...)</p>
              {validationErrors.phone && (
                <p className="text-[10px] text-rose-600 font-semibold mt-1">{validationErrors.phone}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email_input" className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="email_input"
                type="email"
                placeholder="sarah.chen@hospital.org"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (validationErrors.email) {
                    setValidationErrors(prev => ({ ...prev, email: "" }));
                  }
                }}
                className={`w-full bg-slate-50 border focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent rounded-lg py-1.5 px-3 text-xs text-slate-800 transition focus:outline-none ${
                  validationErrors.email ? "border-rose-500" : "border-slate-200"
                }`}
              />
              <p className="text-[10px] text-slate-400 font-medium">Official patient message stream channel</p>
              {validationErrors.email && (
                <p className="text-[10px] text-rose-600 font-semibold mt-1">{validationErrors.email}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: Address Information */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <MapPin className="w-4 h-4 text-teal-accent" />
            <h2 className="text-xs font-bold text-navy-primary uppercase tracking-wider">
              Residential Address <span className="text-[10px] text-slate-400 font-normal normal-case ml-1">(Optional)</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Address Line 1 */}
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="address_line1_input" className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                Address Line 1
              </label>
              <input
                id="address_line1_input"
                type="text"
                placeholder="100 Medical Plaza Dr., Suite 450"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent rounded-lg py-1.5 px-3 text-xs text-slate-800 transition focus:outline-none"
              />
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <label htmlFor="address_city_input" className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                City
              </label>
              <input
                id="address_city_input"
                type="text"
                placeholder="San Francisco"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent rounded-lg py-1.5 px-3 text-xs text-slate-800 transition focus:outline-none"
              />
            </div>

            {/* State */}
            <div className="space-y-1.5">
              <label htmlFor="address_state_input" className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                State / Province
              </label>
              <input
                id="address_state_input"
                type="text"
                placeholder="CA"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent rounded-lg py-1.5 px-3 text-xs text-slate-800 transition focus:outline-none"
              />
            </div>

            {/* Postal Code */}
            <div className="space-y-1.5">
              <label htmlFor="address_zip_input" className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                Postal / ZIP Code
              </label>
              <input
                id="address_zip_input"
                type="text"
                placeholder="94143"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent rounded-lg py-1.5 px-3 text-xs text-slate-800 transition focus:outline-none"
              />
            </div>

            {/* Country */}
            <div className="space-y-1.5">
              <label htmlFor="address_country_input" className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider">
                Country
              </label>
              <input
                id="address_country_input"
                type="text"
                placeholder="United States"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent rounded-lg py-1.5 px-3 text-xs text-slate-800 transition focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Informative Audit Compliance box */}
        <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl text-[11px] text-slate-500 leading-relaxed flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-teal-accent mt-0.5 shrink-0" />
          <p>
            Modifying clinical demographic registry entries commits resources instantly into standard HL7 FHIR stream stores with safe audit profiles.
          </p>
        </div>

        {/* Submit Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            id="patient-form-cancel-btn"
            to={isEdit ? `/patients/${patientId}` : "/patients"}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition"
          >
            Cancel
          </Link>
          <button
            id="patient-form-submit-btn"
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-navy-primary hover:bg-navy-primary/95 text-white text-xs font-semibold rounded-lg shadow-md transition disabled:opacity-75 cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {isEdit ? "Saving Patient..." : "Creating Patient..."}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {isEdit ? "Update Biography" : "Create Patient Record"}
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
};
