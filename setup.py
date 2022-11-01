# ERPNext Expenses © 2022
# Author:  Ameen Ahmed
# Company: Level Up Marketing & Software Development Services
# Licence: Please refer to license.txt


from setuptools import setup, find_packages
from expenses import __version__ as version


with open('requirements.txt') as f:
    install_requires = f.read().strip().split('\n')


setup(
    name='expenses',
    version=version,
    description='An expenses management module for ERPNext.',
    author='Ameen Ahmed (Level Up)',
    author_email='kid1194@gmail.com',
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=install_requires
)