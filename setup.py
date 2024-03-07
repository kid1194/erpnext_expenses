# Expenses © 2024
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to LICENSE file


from setuptools import setup, find_packages


with open("requirements.txt") as f:
    install_requires = f.read().strip().split("\n")


setup(
    name="expenses",
    version="1.0.0",
    description="An expenses management module for ERPNext",
    author="Ameen Ahmed (Level Up)",
    author_email="kid1194@gmail.com",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=install_requires
)