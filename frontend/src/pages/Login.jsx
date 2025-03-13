import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import Container from "../components/Container";
import Card from "../components/Card";
import Logo from "../components/Logo";
import Heading from "../components/Heading";
import Text from "../components/Text";
import Input from "../components/Input";
import Button from "../components/Button";
import TextButton from "../components/TextButton";

const Login = () => {
  const { role } = useParams();
  const navigate = useNavigate();

  if (!role) {
    return <div className="text-center text-red-500">Invalid Role Selection</div>;
  }

  const handleLogin = () => {
    switch (role.toLowerCase()) {
      case "admin":
        navigate("/admin/home");
        break;
      case "departmenthead":
        navigate("/department-head/home");
        break;
      case "ssd":
        navigate("/ssd/home");
        break;
      default:
        alert("Invalid role");
    }
  };

  return (
    <Container className="flex items-center justify-center min-h-screen bg-[#f5f6fc]">
      <Card className="w-[350px] p-6 shadow-lg rounded-lg text-center bg-white">
        <Logo />
        <Heading>{role.charAt(0).toUpperCase() + role.slice(1)} Login</Heading>
        <Text className="text-gray-500">Enter your credentials to continue</Text>

        <form className="mt-4 space-y-4">
          <Input type="text" placeholder="Username" />
          <Input type="password" placeholder="Password" />
          <Button className="hover:font-bold" onClick={handleLogin}>
            <strong>Login</strong>
          </Button>
        </form>

        <div className="mt-2 flex justify-end text-sm">
          <TextButton className="text-red-500 hover:text-red-800">
            Forgot your Password?
          </TextButton>
        </div>

        <div className="mt-4 flex justify-center text-sm gap-1">
          <Text>New User</Text>
          <TextButton className="text-blue-500 hover:text-green-500">
            Sign Up
          </TextButton>
          <Text>Here</Text>
        </div>
      </Card>
    </Container>
  );
};

export default Login;
