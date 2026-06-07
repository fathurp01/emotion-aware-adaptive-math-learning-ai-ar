/**
 * Database Seeder
 * 
 * Run: npx ts-node prisma/seed.ts
 * 
 * Seeds the database with initial data:
 * - Sample chapters
 * - Sample materials
 * - Demo users (student & teacher)
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

function sha256(input: string): string {
  return createHash('sha256').update(input ?? '', 'utf8').digest('hex');
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Create demo users
  console.log('Creating demo users...');
  
  const hashedPassword = await bcrypt.hash('password123', 10);

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@demo.com' },
    update: {},
    create: {
      email: 'teacher@demo.com',
      name: 'Demo Teacher',
      password: hashedPassword,
      role: 'TEACHER',
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@demo.com' },
    update: {},
    create: {
      email: 'student@demo.com',
      name: 'Demo Student',
      password: hashedPassword,
      role: 'STUDENT',
      learningStyle: 'VISUAL',
    },
  });

  console.log('✓ Created users:', { teacher: teacher.email, student: student.email });

  // Create chapters
  console.log('\nCreating chapters...');

  const chapter1 = await prisma.chapter.upsert({
    where: { id: 'ch1' },
    update: {},
    create: {
      id: 'ch1',
      title: 'Basic Algebra',
      description: 'Introduction to algebra concepts and linear equations',
      orderIndex: 1,
    },
  });

  const chapter2 = await prisma.chapter.upsert({
    where: { id: 'ch2' },
    update: {},
    create: {
      id: 'ch2',
      title: 'Geometry',
      description: 'Shapes, area, and volume of geometric figures',
      orderIndex: 2,
    },
  });

  const chapter3 = await prisma.chapter.upsert({
    where: { id: 'ch3' },
    update: {},
    create: {
      id: 'ch3',
      title: 'Numbers & Social Arithmetic',
      description: 'Numbers, fractions, percentages, and daily applications',
      orderIndex: 3,
    },
  });

  const chapter4 = await prisma.chapter.upsert({
    where: { id: 'ch4' },
    update: {},
    create: {
      id: 'ch4',
      title: 'Statistics & Probability',
      description: 'Data processing and simple probability',
      orderIndex: 4,
    },
  });

  const chapter5 = await prisma.chapter.upsert({
    where: { id: 'ch5' },
    update: {},
    create: {
      id: 'ch5',
      title: 'Ratio & Scale',
      description: 'Ratios, map scales, and direct/inverse proportions',
      orderIndex: 5,
    },
  });

  const chapter6 = await prisma.chapter.upsert({
    where: { id: 'ch6' },
    update: {},
    create: {
      id: 'ch6',
      title: 'Functions & Transformations',
      description: 'Function concepts, graphs, and geometric transformations',
      orderIndex: 6,
    },
  });

  console.log('✓ Created chapters:', chapter1.title, chapter2.title, chapter3.title, chapter4.title, chapter5.title, chapter6.title);

  // Create materials
  console.log('\nCreating materials...');

  const materials: Array<{
    id: string;
    title: string;
    chapterId: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    content: string;
  }> = [
    {
      id: 'mat1',
      title: 'Linear Equations in One Variable',
      chapterId: chapter1.id,
      difficulty: 'EASY',
      content: `# Linear Equations in One Variable (PLSV)

## Learning Objectives
- Understand the general form of PLSV and its components.
- Solve PLSV with sequential steps.
- Check the correctness of the solution by substitution.

## Core Concepts
A linear equation in one variable is an equation that contains **one variable** (e.g., $x$) with the highest power of **1**.

**General form:**
$$ax + b = c$$
where $a \\neq 0$.

## Solving Strategy
1. **Simplify** (if there are brackets/fractions).
2. **Group** terms containing the variable on one side.
3. **Group** constants on the other side.
4. **Divide** both sides by the variable's coefficient.
5. **Check** by substitution.

## Example 1
Solve $2x + 5 = 11$.

Steps:
$$2x = 11 - 5 = 6$$
$$x = 6/2 = 3$$
Check: $2(3) + 5 = 11$ (correct).

## Example 2
Solve $3x - 7 = 8$.

$$3x = 8 + 7 = 15$$
$$x = 15/3 = 5$$

## Exercises
1. $x + 9 = 17$
2. $5x - 10 = 25$
3. $4(x - 2) = 20$

## Answer Key
1) $x=8$  2) $x=7$  3) $x=7$`,
    },
    {
      id: 'mat2',
      title: 'System of Linear Equations in Two Variables',
      chapterId: chapter1.id,
      difficulty: 'MEDIUM',
      content: `# System of Linear Equations in Two Variables (SPLDV)

## Learning Objectives
- Understand SPLDV as a pair of linear equations.
- Solve SPLDV using elimination and substitution.
- Interpret the solution as the intersection point of two lines.

## Core Concepts
SPLDV consists of two linear equations with the same two variables, for example $x$ and $y$:
$$a_1x + b_1y = c_1$$
$$a_2x + b_2y = c_2$$

The solution to SPLDV is the pair $(x,y)$ that satisfies **both**.

## Elimination Method
General steps:
1. Equalize the coefficients of one variable.
2. Add/subtract the two equations to eliminate that variable.
3. Obtain one variable, then substitute to find the other.

## Example (Elimination)
Solve:
$$x + y = 5$$
$$2x - y = 1$$

Add the two equations:
$$3x = 6 \\Rightarrow x = 2$$
Substitute into $x+y=5$:
$$2 + y = 5 \\Rightarrow y = 3$$
So $(x,y)=(2,3)$.

## Substitution Method
General steps:
1. Express one variable from one of the equations.
2. Substitute into the other equation.
3. Solve and check.

## Exercises
1. $x - y = 4$ and $x + y = 10$
2. $2x + y = 11$ and $x - y = 1$
3. $3x + 2y = 16$ and $x + 2y = 8$

## Answer Key
1) $(7,3)$  2) $(4,3)$  3) $(4,2)$`,
    },
    {
      id: 'mat3',
      title: 'Circles: Circumference, Area, and Applications',
      chapterId: chapter2.id,
      difficulty: 'EASY',
      content: `# Circles: Circumference, Area, and Applications

## Learning Objectives
- Use formulas for the circumference and area of a circle.
- Determine radius/diameter from circumference/area information.
- Apply to word problems.

## Core Concepts
A circle is the set of points in a plane that are equidistant from the center.

Notation:
- $r$ = radius
- $d$ = diameter, where $d=2r$
- $\\pi \\approx 3.14$ or $\\pi = 22/7$ (if suitable)

## Important Formulas
Circumference:
$$C = 2\\pi r = \\pi d$$
Area:
$$A = \\pi r^2$$

## Example 1
$r=7$ cm, find $C$ and $A$.

$$C = 2\\cdot \\frac{22}{7}\\cdot 7 = 44\\text{ cm}$$
$$A = \\frac{22}{7}\\cdot 7^2 = 154\\text{ cm}^2$$

## Example 2
Circumference $C=88$ cm, find $r$.
$$88 = 2\\cdot \\frac{22}{7}\\cdot r \\Rightarrow r=14\\text{ cm}$$

## Exercises
1. $d=10$ cm, calculate $C$.
2. $r=14$ cm, calculate $A$ (use $\\pi=22/7$).
3. A circular park has $r=7$ m. What is the circumference of the fence?

## Answer Key
1) $C=31.4$ cm  2) $A=616\\text{ cm}^2$  3) $C=44$ m`,
    },
    {
      id: 'mat4',
      title: 'Integer Operations & Properties',
      chapterId: chapter3.id,
      difficulty: 'EASY',
      content: `# Integer Operations & Properties

## Learning Objectives
- Calculate addition, subtraction, multiplication, and division of integers.
- Understand commutative, associative, and distributive properties.

## Core Concepts
Integers include $\\{\\ldots,-3,-2,-1,0,1,2,3,\\ldots\\}$.

### Sign Rules (Summary)
- $(-) + (-)$ results in negative.
- $(-) \\times (-)$ results in positive.
- $(-) \\times (+)$ results in negative.

## Operation Properties
- Commutative: $a+b=b+a$, $a\\times b=b\\times a$
- Associative: $(a+b)+c=a+(b+c)$, $(a\\times b)\\times c=a\\times (b\\times c)$
- Distributive: $a(b+c)=ab+ac$

## Examples
1. $-7 + 12 = 5$
2. $-4 \\times 6 = -24$
3. $-18 \\div 3 = -6$
4. $3(5-2)=3\\cdot 5-3\\cdot 2=15-6=9$

## Exercises
1. $-15 + 8$
2. $-9 - (-4)$
3. $(-6)\\times(-7)$

## Answer Key
1) $-7$  2) $-5$  3) $42$`,
    },
    {
      id: 'mat5',
      title: 'Fractions: Forms, Operations, and Simplification',
      chapterId: chapter3.id,
      difficulty: 'MEDIUM',
      content: `# Fractions: Forms, Operations, and Simplification

## Learning Objectives
- Simplify fractions and convert forms (proper, mixed, decimal).
- Perform fraction arithmetic operations.

## Core Concepts
Fraction $\\frac{a}{b}$ where $b\\neq 0$.

### Simplifying
Use the GCD of the numerator and denominator.
Example: $\\frac{12}{18} = \\frac{12\\div 6}{18\\div 6}=\\frac{2}{3}$.

### Addition/Subtraction
Equalize denominators (LCM).
Example: $\\frac{1}{4}+\\frac{1}{6}=\\frac{3}{12}+\\frac{2}{12}=\\frac{5}{12}$.

### Multiplication
Multiply numerators and denominators:
$\\frac{2}{3}\\times\\frac{3}{5}=\\frac{6}{15}=\\frac{2}{5}$.

### Division
Multiply by the reciprocal:
$\\frac{3}{4}\\div\\frac{2}{5}=\\frac{3}{4}\\times\\frac{5}{2}=\\frac{15}{8}=1\\frac{7}{8}$.

## Exercises
1. Simplify $\\frac{24}{36}$.
2. Calculate $\\frac{2}{7}+\\frac{3}{14}$.
3. Calculate $\\frac{5}{6}\\div\\frac{5}{12}$.

## Answer Key
1) $\\frac{2}{3}$  2) $\\frac{1}{2}$  3) $2$`,
    },
    {
      id: 'mat6',
      title: 'Percentages & Value Changes (Increase/Decrease)',
      chapterId: chapter3.id,
      difficulty: 'MEDIUM',
      content: `# Percentages & Value Changes (Increase/Decrease)

## Learning Objectives
- Convert fractions/decimals to percentages and vice versa.
- Calculate percentage values of a quantity.
- Calculate percentage increase/decrease.

## Core Concepts
Percent means per hundred: $p\\% = \\frac{p}{100}$.

## Practical Formulas
- $p\\%$ of $N$ is $\\frac{p}{100}\\times N$.
- New value after $p\\%$ increase: $N_{new}=N\\times(1+\\frac{p}{100})$.
- New value after $p\\%$ decrease: $N_{new}=N\\times(1-\\frac{p}{100})$.

## Examples
1. $15\\%$ of 200 = $0.15\\times 200=30$.
2. Price 80,000 increases by 10%: $80,000\\times 1.10=88,000$.
3. Value 90 decreases by 20%: $90\\times 0.80=72$.

## Exercises
1. Convert $0.35$ to percentage.
2. $12\\%$ of 250?
3. Weight 50 kg decreases by 8%, what is it now?

## Answer Key
1) $35\\%$  2) $30$  3) $46$ kg`,
    },
    {
      id: 'mat7',
      title: 'Social Arithmetic: Profit, Loss, Discount, Tax',
      chapterId: chapter3.id,
      difficulty: 'MEDIUM',
      content: `# Social Arithmetic: Profit, Loss, Discount, Tax

## Learning Objectives
- Calculate profit/loss and their percentages.
- Calculate successive discounts.
- Calculate price after tax.

## Core Concepts
- Buying Price (BP), Selling Price (SP)
- Profit: $P=SP-BP$ (if $SP>BP$)
- Loss: $L=BP-SP$ (if $SP<BP$)

Percentage profit:
$$\\%P=\\frac{P}{BP}\\times 100\\%$$

## Example 1 (Discount)
Price 200,000 discount 15%.
$$\\text{Discount}=0.15\\times 200,000=30,000$$
Price to pay = 170,000.

## Example 2 (Profit)
BP 50,000 sold for 60,000.
Profit = 10,000, profit percentage $=\\frac{10,000}{50,000}\\times 100\\%=20\\%$.

## Exercises
1. BP 80,000, SP 72,000. How much loss and loss percentage?
2. Price 120,000 discount 10% then another 5%. How much to pay?
3. Price after 11% tax from 300,000?

## Answer Key
1) loss 8,000; 10%  2) 102,600  3) 333,000`,
    },
    {
      id: 'mat8',
      title: 'Direct & Inverse Proportions',
      chapterId: chapter5.id,
      difficulty: 'MEDIUM',
      content: `# Direct & Inverse Proportions

## Learning Objectives
- Recognize direct and inverse proportions.
- Solve ratio problems using tables/cross-multiplication.

## Core Concepts
### Direct Proportion
If $x$ increases, $y$ increases (or both decrease). Form: $\\frac{y}{x}=k$.

Example: 2 kg sugar = 30,000, then 5 kg = ?

### Inverse Proportion
If $x$ increases, $y$ decreases. Form: $x\\cdot y = k$.

Example: 4 workers finish in 6 days, then 8 workers = ?

## Examples
1) Direct: 2 kg 30,000 → 1 kg 15,000 → 5 kg 75,000.

2) Inverse:
$$4\\times 6 = 24$$
If 8 workers, days $=24/8=3$.

## Exercises
1. 3 books cost 45,000. Cost of 8 books?
2. 12 taps fill a tank in 5 minutes. If 6 taps, how many minutes?
3. 6 liters of petrol for 90 km. Distance for 10 liters?

## Answer Key
1) 120,000  2) 10 minutes  3) 150 km`,
    },
    {
      id: 'mat9',
      title: 'Map Scales & Plans',
      chapterId: chapter5.id,
      difficulty: 'EASY',
      content: `# Map Scales & Plans

## Learning Objectives
- Use scale to determine actual distance.
- Calculate map distance from actual distance.

## Core Concepts
Scale is the ratio of distance on map (MD) to actual distance (AD).
$$\\text{Scale} = \\frac{MD}{AD}$$

If scale is 1 : 50,000 it means 1 cm on map = 50,000 cm actually.

## Quick Steps
1. Equalize units (usually cm).
2. Use formulas:
   - $AD = MD \\times \\text{scale denominator}$
   - $MD = AD \\div \\text{scale denominator}$

## Example
Scale 1:100,000, distance on map 3 cm.
$$AD = 3\\times 100,000 = 300,000\\text{ cm} = 3\\text{ km}$$

## Exercises
1. Scale 1:50,000, MD 8 cm. How many km?
2. AD 12 km, scale 1:200,000. How many cm on map?
3. Scale 1:25,000, MD 6 cm. How many meters?

## Answer Key
1) 4 km  2) 6 cm  3) 1,500 m`,
    },
    {
      id: 'mat10',
      title: 'Sets: Notation, Members, and Basic Operations',
      chapterId: chapter1.id,
      difficulty: 'EASY',
      content: `# Sets: Notation, Members, and Basic Operations

## Learning Objectives
- Write sets using listing and builder notation.
- Use intersection and union operations.

## Core Concepts
A set is a well-defined collection of objects.

Notation:
- $A=\\{1,2,3\\}$
- $x\\in A$ means $x$ is a member of A.

## Basic Operations
- Union: $A\\cup B$ (members in A or B)
- Intersection: $A\\cap B$ (members in A and B)

## Example
Let $A=\\{1,2,3,4\\}$ and $B=\\{3,4,5\\}$.
- $A\\cup B=\\{1,2,3,4,5\\}$
- $A\\cap B=\\{3,4\\}$

## Exercises
1. Write the set of even numbers less than 10.
2. If $A=\\{a,b,c\\}$, $B=\\{b,c,d\\}$, determine $A\\cap B$.
3. Determine $A\\cup B$ for question number 2.

## Answer Key
1) $\\{2,4,6,8\\}$  2) $\\{b,c\\}$  3) $\\{a,b,c,d\\}$`,
    },
    {
      id: 'mat11',
      title: 'Lines and Angles: Types & Relationships',
      chapterId: chapter2.id,
      difficulty: 'EASY',
      content: `# Lines and Angles

## Learning Objectives
- Identify types of angles (acute, right, obtuse, straight).
- Use supplementary and complementary angle relationships.

## Core Concepts
- Right angle: $90^\\circ$
- Straight angle: $180^\\circ$
- Complementary: sum is $90^\\circ$
- Supplementary: sum is $180^\\circ$

## Examples
1. If angle A is complementary to angle B and $A=35^\\circ$, then $B=90^\\circ-35^\\circ=55^\\circ$.
2. If angle C is supplementary to angle D and $C=120^\\circ$, then $D=180^\\circ-120^\\circ=60^\\circ$.

## Exercises
1. Angle X is complementary to angle Y. If X=48°, determine Y.
2. Angle P is supplementary to angle Q. If Q=73°, determine P.
3. Determine the type of angle: 20°, 90°, 130°, 180°.

## Answer Key
1) 42°  2) 107°  3) acute, right, obtuse, straight`,
    },
    {
      id: 'mat12',
      title: 'Triangles & Quadrilaterals: Perimeter & Area',
      chapterId: chapter2.id,
      difficulty: 'MEDIUM',
      content: `# Triangles & Quadrilaterals: Perimeter & Area

## Learning Objectives
- Calculate perimeter and area of triangles.
- Calculate area of squares, rectangles, parallelograms, and trapezoids.

## Quick Formulas
### Triangle
Perimeter: sum of sides.
Area:
$$A=\\frac{1}{2}\\times b \\times h$$

### Square
$$A=s^2,\\quad P=4s$$

### Rectangle
$$A=l\\times w,\\quad P=2(l+w)$$

### Parallelogram
$$A=b\\times h$$

### Trapezoid
$$A=\\frac{1}{2}(a+b)\\times h$$

## Example
Trapezoid with parallel sides 10 cm and 6 cm, height 5 cm:
$$A=\\frac{1}{2}(10+6)\\times 5=40\\text{ cm}^2$$

## Exercises
1. Triangle base 12 cm height 8 cm. Area?
2. Rectangle l=15 cm w=7 cm. Perimeter?
3. Parallelogram base 9 cm height 6 cm. Area?

## Answer Key
1) 48 cm²  2) 44 cm  3) 54 cm²`,
    },
    {
      id: 'mat13',
      title: 'Pythagorean Theorem',
      chapterId: chapter2.id,
      difficulty: 'MEDIUM',
      content: `# Pythagorean Theorem

## Learning Objectives
- Use Pythagoras for right-angled triangles.
- Determine the length of the hypotenuse or other sides.

## Core Concepts
For a right-angled triangle with legs $a$ and $b$, and hypotenuse $c$:
$$a^2+b^2=c^2$$

## Example 1
$a=6$, $b=8$.
$$c=\\sqrt{6^2+8^2}=\\sqrt{36+64}=\\sqrt{100}=10$$

## Example 2
$c=13$, $a=5$.
$$b=\\sqrt{13^2-5^2}=\\sqrt{169-25}=\\sqrt{144}=12$$

## Exercises
1. $a=9$, $b=12$, determine $c$.
2. $c=17$, $a=8$, determine $b$.
3. Do 7, 24, 25 form a right-angled triangle?

## Answer Key
1) 15  2) 15  3) yes, because $7^2+24^2=25^2$`,
    },
    {
      id: 'mat14',
      title: '3D Shapes: Prisms & Pyramids (Volume & Surface Area)',
      chapterId: chapter2.id,
      difficulty: 'HARD',
      content: `# 3D Shapes: Prisms & Pyramids

## Learning Objectives
- Calculate volume of prisms and pyramids.
- Understand surface area as the sum of face areas.

## Prism
Prisms have two congruent and parallel bases.

Volume of prism:
$$V = A_{base} \\times h$$

## Pyramid
Pyramids have one base and triangular vertical faces meeting at an apex.

Volume of pyramid:
$$V = \\frac{1}{3} A_{base} \\times h$$

## Examples
Triangular prism with $A_{base}=24\\text{ cm}^2$ and height 10 cm:
$$V=24\\times 10=240\\text{ cm}^3$$

Pyramid with $A_{base}=36\\text{ cm}^2$ and height 9 cm:
$$V=\frac{1}{3}\\times 36\\times 9=108\\text{ cm}^3$$

## Exercises
1. Prism with $A_{base}=30$ cm², height 12 cm. Volume?
2. Pyramid with $A_{base}=50$ cm², height 6 cm. Volume?
3. Explain in your own words why the pyramid volume has a factor of $\\frac{1}{3}$.

## Answer Key
1) 360 cm³  2) 100 cm³  3) (conceptual answer)`,
    },
    {
      id: 'mat15',
      title: '3D Shapes: Cylinders & Cones',
      chapterId: chapter2.id,
      difficulty: 'HARD',
      content: `# Cylinders & Cones

## Learning Objectives
- Calculate volume of cylinders and cones.
- Use surface area formulas for cylinders.

## Cylinder
Volume:
$$V=\\pi r^2 h$$

Surface Area:
$$A=2\\pi r(r+h)$$

## Cone
Volume:
$$V=\\frac{1}{3}\\pi r^2 h$$

## Example
Cylinder $r=7$ cm, $h=10$ cm:
$$V=\\frac{22}{7}\\cdot 7^2\\cdot 10=1540\\text{ cm}^3$$

## Exercises
1. Cylinder $r=5$ cm, $h=12$ cm. Volume (use $\\pi=3.14$)?
2. Cone $r=6$ cm, $h=9$ cm. Volume (use $\\pi=3.14$)?
3. Cylinder $r=3$ cm, $h=8$ cm. Surface Area (use $\\pi=3.14$)?

## Answer Key
1) 942 cm³  2) 339.12 cm³  3) 207.24 cm²`,
    },
    {
      id: 'mat16',
      title: 'Basic Statistics: Mean, Median, Mode',
      chapterId: chapter4.id,
      difficulty: 'EASY',
      content: `# Basic Statistics: Mean, Median, Mode

## Learning Objectives
- Determine mean, median, and mode.
- Interpret measures of central tendency.

## Core Concepts
Given data: 2, 3, 3, 7, 10.
- Mean: sum of data divided by count.
- Median: middle value after sorting.
- Mode: most frequent value.

## Example
Data: 4, 6, 6, 8, 10
- Mean: $(4+6+6+8+10)/5 = 34/5 = 6.8$
- Median: 6
- Mode: 6

## Exercises
1. Data: 5, 7, 9, 9, 10. Mean?
2. Data: 2, 4, 6, 8. Median?
3. Data: 1, 2, 2, 2, 5. Mode?

## Answer Key
1) 8  2) 5  3) 2`,
    },
    {
      id: 'mat17',
      title: 'Data Presentation: Tables & Charts',
      chapterId: chapter4.id,
      difficulty: 'MEDIUM',
      content: `# Data Presentation: Tables & Charts

## Learning Objectives
- Convert data into simple frequency tables.
- Choose suitable charts (bar, line, pie).

## Core Concepts
- Bar chart: comparing categories.
- Line chart: observing change over time.
- Pie chart: observing composition (percentage).

## Example
Hobby data of 20 students: Football 8, Music 6, Reading 4, Others 2.
- Football percentage: $8/20=40\\%$.

Pie chart: football sector angle $=40\\%\\times 360^\\circ=144^\\circ$.

## Exercises
1. Total 50 students: 15 like basketball. What percentage?
2. If a pie chart sector is 90°, what percentage is it?
3. When is it more appropriate to use a line chart?

## Answer Key
1) 30%  2) 25%  3) when data changes over time`,
    },
    {
      id: 'mat18',
      title: 'Simple Probability',
      chapterId: chapter4.id,
      difficulty: 'MEDIUM',
      content: `# Simple Probability

## Learning Objectives
- Calculate probability of simple experiments.
- Determine sample space and events.

## Core Concepts
Probability of event $A$:
$$P(A)=\\frac{n(A)}{n(S)}$$
where $n(A)$ is the number of favorable outcomes, and $n(S)$ is the total number of outcomes (sample space).

## Examples
1) Throwing a die: sample space 6 outcomes.
Probability of even number (2,4,6):
$$P=\\frac{3}{6}=\\frac{1}{2}$$

2) Tossing a coin: probability of heads = $1/2$.

## Exercises
1. Throwing a die, probability of getting 5?
2. Picking 1 ball from a box with 3 red, 2 blue. Probability of blue?
3. Tossing 2 coins, probability of getting 2 heads?

## Answer Key
1) $1/6$  2) $2/5$  3) $1/4$`,
    },
    {
      id: 'mat19',
      title: 'Functions & Simple Graphs',
      chapterId: chapter6.id,
      difficulty: 'HARD',
      content: `# Functions & Simple Graphs

## Learning Objectives
- Understand functions as input-output rules.
- Fill value tables and draw simple graphs.

## Core Concepts
Function $f(x)$ is a rule that maps every $x$ to exactly one $y$ value.

Example of linear function:
$$y=2x+1$$

## Graphing Steps
1. Choose several $x$ values (e.g., -2, -1, 0, 1, 2).
2. Calculate $y$ for each $x$.
3. Plot points $(x,y)$ and connect them.

## Example
For $y=2x+1$:
- $x=0 \\Rightarrow y=1$
- $x=1 \\Rightarrow y=3$
- $x=2 \\Rightarrow y=5$

## Exercises
1. Make a value table for $y=x-3$ (x: 0,1,2,3).
2. Y-intercept of $y=4x-2$?
3. If $y=3x+6$ and $x=-2$, what is $y$?

## Answer Key
1) (0,-3),(1,-2),(2,-1),(3,0)  2) -2  3) 0`,
    },
    {
      id: 'mat20',
      title: 'Geometric Transformations',
      chapterId: chapter6.id,
      difficulty: 'HARD',
      content: `# Geometric Transformations

## Learning Objectives
- Recognize four basic transformations on a plane.
- Calculate image coordinates after simple transformations.

## Core Concepts
Let point $P(x,y)$.

### 1) Translation
Shift by $(a,b)$:
$$P'(x+a, y+b)$$

### 2) Reflection
- Across x-axis: $(x,-y)$
- Across y-axis: $(-x,y)$

### 3) Rotation (center O)
- 90° counter-clockwise: $(x,y)\\to(-y,x)$
- 180°: $(x,y)\\to(-x,-y)$

### 4) Dilation
Scale $k$ (center O):
$$P'(kx, ky)$$

## Example
Point P(2,-1) translated by (3,4) → P'(5,3).

## Exercises
1. Q(-3,2) reflected across y-axis.
2. R(1,4) rotated 180° around O.
3. S(2,3) dilated by scale 2 around O.

## Answer Key
1) (3,2)  2) (-1,-4)  3) (4,6)`,
    },
  ];

  let createdOrUpdated = 0;
  for (const m of materials) {
    await prisma.material.upsert({
      where: { id: m.id },
      update: {
        title: m.title,
        chapterId: m.chapterId,
        difficulty: m.difficulty,
        content: m.content,
        contentVersion: sha256(m.content),
      },
      create: {
        id: m.id,
        title: m.title,
        chapterId: m.chapterId,
        difficulty: m.difficulty,
        content: m.content,
        contentVersion: sha256(m.content),
        imageUrl: null,
      },
    });
    createdOrUpdated++;
  }

  console.log(`✓ Seeded ${createdOrUpdated} materials (mat1..mat20)`);

  console.log('\n✅ Seeding completed successfully!\n');
  console.log('Demo accounts:');
  console.log('  Teacher: teacher@demo.com / password123');
  console.log('  Student: student@demo.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
