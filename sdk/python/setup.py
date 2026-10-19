from setuptools import setup, find_packages

setup(
    name="tracexmail",
    version="1.0.0",
    description="Official Python SDK for TraceXMail Forensic Email Defense Platform",
    author="TraceXMail Security Engineering",
    packages=find_packages(),
    install_requires=["requests>=2.28.0"],
    python_requires=">=3.8"
)
