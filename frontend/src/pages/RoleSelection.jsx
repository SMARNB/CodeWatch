import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Container from "../components/Container";
import Card from "../components/Card";
import Logo from "../components/Logo";
import Heading from "../components/Heading";
import Text from "../components/Text";
import Button from "../components/Button";

const RoleSelection = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState("");

  const handleContinue = () => {
    if (selectedRole) {
      navigate(`/Login/${selectedRole}`); // Pass role as URL param
    }
  };
  

  return (
    <Container className="bg-indigo-50">
      <Card className="w-96">
        <Logo />
        <Heading>User Type</Heading>
        <Text>Select a user type to continue</Text>

        <div className="mt-4">
          {["Admin", "SSD", "Department Head"].map((role) => (
            <button
              key={role}
              className={`w-full py-2 px-4 my-2 rounded-md border text-white ${
                selectedRole === role ? "border-blue bg-blue text-white" : "border-blue"
              }`}
              onClick={() => setSelectedRole(role)}
            >
              {role}
            </button>
          ))}
        </div>

        <Button onClick={handleContinue} className="bg-blue-600 hover:bg-blue-700 mt-4">
          Continue
        </Button>
      </Card>
    </Container>
  );
};

export default RoleSelection;
